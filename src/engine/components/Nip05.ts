import {last} from "ramda"
import {nip05} from "nostr-tools"
import {tryFunc} from "hurdak"
import {now, tryJson} from "src/util/misc"
import type {Handle} from "src/engine/types"
import type {Engine} from "src/engine/Engine"
import {collection} from "src/engine/util/store"

export class Nip05 {
  handles = collection<Handle>("pubkey")

  getHandle = (pubkey: string) => this.handles.key(pubkey).get()

  displayHandle = (handle: Handle) =>
    handle.address.startsWith("_@") ? last(handle.address.split("@")) : handle.address

  initialize(engine: Engine) {
    engine.Events.addHandler(0, e => {
      tryJson(async () => {
        const kind0 = JSON.parse(e.content)
        const handle = this.handles.key(e.pubkey)

        if (!kind0.nip05 || e.created_at < (handle.get()?.created_at || 0)) {
          return
        }

        const profile = (await tryFunc(() => nip05.queryProfile(kind0.nip05))) as null | {
          pubkey: string
        }

        if (profile?.pubkey !== e.pubkey) {
          return
        }

        handle.set({
          profile: profile,
          pubkey: e.pubkey,
          address: kind0.nip05,
          created_at: e.created_at,
          updated_at: now(),
        })
      })
    })
  }
}
