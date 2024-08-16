import {equals} from "ramda"
import type {EventTemplate} from "nostr-tools"
import {Emitter, now} from "@welshman/lib"
import {createEvent} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import type {Subscription} from "@welshman/net"
import {subscribe, publish} from "@welshman/net"
import {randomId, sleep} from "hurdak"
import {NostrConnect} from "nostr-tools/kinds"
import logger from "src/util/logger"
import {tryJson} from "src/util/misc"
import type {NostrConnectHandler, Session} from "src/engine/model"
import { getNip04, getSigner } from "./getters"
import type { Nip04 } from "./nip04"
import type { Signer } from "./signer"

let singleton: NostrConnectBroker

// FIXME set the full list of requested perms
const Perms =
  "nip04_encrypt,nip04_decrypt,sign_event:0,sign_event:1,sign_event:4,sign_event:6,sign_event:7"

export class NostrConnectBroker extends Emitter {
  #sub: Subscription
  #ready = sleep(500)
  #closed = false
  #connectResult: any
  #nip04: Nip04
  #signer: Signer

  static get(pubkey, connectSession: Session, handler: NostrConnectHandler) {
    if (
      singleton?.pubkey !== pubkey ||
      singleton?.connectSession.method !== connectSession.method ||
      singleton?.connectSession.pubkey !== connectSession.pubkey ||
      !equals(singleton?.handler, handler)
    ) {
      singleton?.teardown()
      singleton = new NostrConnectBroker(pubkey, connectSession, handler)
    }

    return singleton
  }

  constructor(
    readonly pubkey: string,
    readonly connectSession: Session,
    readonly handler: NostrConnectHandler,
  ) {
    super()

    this.#nip04 = getNip04(connectSession)
    this.#signer = getSigner(connectSession)

    this.subscribe()
  }

  subscribe() {
    this.#sub = subscribe({
      relays: this.handler.relays,
      filters: [
        {
          since: now() - 30,
          kinds: [NostrConnect],
          "#p": [this.connectSession.pubkey],
        },
      ],
    })

    this.#sub.emitter.on("event", async (url: string, e: TrustedEvent) => {
      const json = await this.#nip04.decryptAsUser(e.content, e.pubkey)
      const {id, result, error} = tryJson(() => JSON.parse(json)) || {error: "invalid-response"}

      logger.info("NostrConnect response:", {id, result, error})

      if (result === "auth_url") {
        this.emit(`auth-${id}`, error)
      } else {
        this.emit(`response-${id}`, {result, error})
      }
    })

    this.#sub.emitter.on("complete", () => {
      if (!this.#closed) {
        this.subscribe()
      }
    })
  }

  async request(method: string, params: string[], admin = false) {
    // nsecbunker has a race condition
    await this.#ready

    const id = randomId()
    const pubkey = admin ? this.handler.pubkey : this.pubkey
    const payload = JSON.stringify({id, method, params})
    const content = await this.#nip04.encryptAsUser(payload, pubkey)
    const template = createEvent(NostrConnect, {content, tags: [["p", pubkey]]})
    const event = await this.#signer.signAsUser(template)

    logger.info("NostrConnect request:", {id, method, params})

    publish({event, relays: this.handler.relays})

    this.once(`auth-${id}`, auth_url => {
      window.open(auth_url, "Coracle", "width=600,height=800,popup=yes")
    })

    return new Promise(resolve => {
      this.once(`response-${id}`, ({result, error}) => {
        if (error) {
          logger.error(error)
          resolve(undefined)
        } else {
          resolve(result)
        }
      })
    })
  }

  createAccount(username: string) {
    if (!this.handler.domain) {
      throw new Error("Unable to create an account without a handler domain")
    }

    return this.request("create_account", [username, this.handler.domain, "", Perms], true)
  }

  async connect(token: string = null) {
    if (!this.#connectResult) {
      const params = [this.pubkey, token || "", Perms]

      this.#connectResult = await this.request("connect", params)
    }

    return this.#connectResult === "ack"
  }

  signEvent(event: EventTemplate) {
    return tryJson(async () => {
      const res = (await this.request("sign_event", [JSON.stringify(event)])) as string

      return JSON.parse(res)
    })
  }

  nip04Encrypt(pk: string, message: string) {
    return this.request("nip04_encrypt", [pk, message])
  }

  nip04Decrypt(pk: string, message: string) {
    return this.request("nip04_decrypt", [pk, message])
  }

  nip44Encrypt(pk: string, message: string) {
    return this.request("nip44_encrypt", [pk, message])
  }

  nip44Decrypt(pk: string, message: string) {
    return this.request("nip44_decrypt", [pk, message])
  }

  teardown() {
    this.#closed = true
    this.#sub?.close()
  }
}

export class Connect {
  broker?: NostrConnectBroker

  constructor(readonly session: Session) {
    if (this.isEnabled()) {
      const {pubkey, connectSession, connectHandler} = session

      this.broker = NostrConnectBroker.get(
        pubkey,
        connectSession,
        connectHandler,
      )
      this.broker.connect()
    }
  }

  isEnabled() {
    return this.session?.method === "connect"
  }
}
