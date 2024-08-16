import type {Publish} from "@welshman/net"
import type {TrustedEvent, Zapper as WelshmanZapper} from "@welshman/util"
import {isTrustedEvent} from "@welshman/util"
import type {RelayProfile} from "src/domain"

export type RelayInfo = RelayProfile & {
  count?: number
  faults?: number[]
  first_seen?: number
  last_checked?: number
}

export type NostrConnectHandler = {
  pubkey?: string
  domain?: string
  relays?: string[]
}

export enum GroupAccess {
  None = null,
  Requested = "requested",
  Granted = "granted",
  Revoked = "revoked",
}

export type Group = {
  id: string
  pubkey: string
  address: string
  members?: string[]
  recent_member_updates?: TrustedEvent[]
}

export type GroupKey = {
  group: string
  pubkey: string
  privkey: string
  created_at: number
  hints?: string[]
}

export type GroupRequest = TrustedEvent & {
  group: string
  resolved: boolean
}

export const isGroupRequest = (e: any): e is GroupRequest =>
  typeof e.group === "string" && typeof e.resolved === "boolean" && isTrustedEvent(e)

export type GroupAlert = TrustedEvent & {
  group: string
  type: "exit" | "invite"
}

export const isGroupAlert = (e: any): e is GroupAlert =>
  typeof e.group === "string" && typeof e.type === "string" && isTrustedEvent(e)

export type DisplayEvent = TrustedEvent & {
  replies?: DisplayEvent[]
  reposts?: TrustedEvent[]
}

export type Zapper = WelshmanZapper & {
  lnurl: string
  pubkey: string
}

export type PublishInfo = Omit<Publish, "emitter" | "result">

export type Notification = {
  key: string
  event: TrustedEvent
  timestamp: number
  interactions: TrustedEvent[]
}

export enum OnboardingTask {
  BackupKey = "backup_key",
  SetupWallet = "setup_wallet",
}
export type Topic = {
  name: string
  count?: number
  last_seen?: number
}

export type Channel = {
  id: string
  relays: string[]
  members: string[]
  last_sent?: number
  last_received?: number
  last_checked?: number
}

export type GroupStatus = {
  joined: boolean
  joined_updated_at: number
  access: GroupAccess
  access_updated_at: number
  last_synced: number
}

export type Session = {
  method: string
  pubkey: string
  privkey?: string
  connectSession?: Session
  connectToken?: string
  connectHandler?: NostrConnectHandler
  settings?: Record<string, any>
  settings_updated_at?: number
  groups_last_synced?: number
  notifications_last_synced?: number
  groups?: Record<string, GroupStatus>
  onboarding_tasks_completed?: string[]
}

export type AnonymousUserState = {
  follows: string[][]
  relays: string[][]
}
