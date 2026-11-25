# Security Specification — Meu Time

## 1. Data Invariants
1. **Master Gate Membership**: Subcollections under `/teams/{teamId}/**` (`members`, `messages`, `matches`, `events`) can ONLY be read or written by authenticated, email-verified users who have a member document at `/teams/{teamId}/members/{request.auth.uid}` (or who are creating the team atomically as `ownerId`).
2. **PII Isolation**: No `email`, `phone`, or `address` is persisted in Firestore documents; `/users/{userId}` and `/users/{userId}/teamMemberships/{teamId}` are strictly restricted to `request.auth.uid == userId`.
3. **Immutable Ownership & Identifiers**: `ownerId`, `teamId`, `createdBy`, `senderId`, and `createdAt` cannot be modified after creation.
4. **Server Timestamp Enforcement**: `createdAt` and `updatedAt` MUST equal `request.time`.
5. **Terminal State Locking**: Once a `Match` reaches `status == 'finished'`, no updates to the match or creation/deletion of its events are permitted.
6. **Strict Invite Join Verification**: A non-owner user can only create `/teams/{teamId}/members/{request.auth.uid}` if they supply a valid `inviteCode` that exists at `/invites/{inviteCode}` and resolves to `teamId`.
7. **Zero-Blanket Reads**: No `allow list` rule relies on client filtering or performs `get()`/`exists()` lookups; `/invites/{inviteCode}` only allows single-document `get`, never `list`.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Write**: Creating `/teams/team1` with `request.auth == null`.
2. **Unverified Email Write**: Creating `/teams/team1` with `request.auth.token.email_verified == false`.
3. **Identity Spoofing on Team Create**: Creating `/teams/team1` with `ownerId: "victim_uid"` while authenticated as `"attacker_uid"`.
4. **Ghost / Shadow Field Injection**: Creating `/teams/team1` with an extra key `isAdmin: true` or `verified: true`.
5. **Oversized ID Poisoning**: Creating `/teams/aaaa...150chars...` exceeding 128 chars or containing invalid symbols (`../`).
6. **Non-Member Chat Injection**: Writing `/teams/team1/messages/msg1` when `request.auth.uid` is not in `/teams/team1/members`.
7. **Chat Sender Spoofing**: Team member writing `/teams/team1/messages/msg1` with `senderId: "other_member_uid"`.
8. **Unauthorized Join Without Invite**: Creating `/teams/team1/members/{attackerUid}` with an invalid or mismatched `inviteCode`.
9. **Invite Enumeration (`list`)**: Querying `list` on `/invites` to scrape all team invite codes.
10. **Match Post-Finish Tampering**: Updating `teamScore` or `status` on `/teams/team1/matches/m1` when existing `status == 'finished'`.
11. **Client Timestamp Forgery**: Creating a message or team with `createdAt` set to a fake past timestamp instead of `request.time`.
12. **Cross-User Profile Hijack**: Reading or writing `/users/victim_uid/teamMemberships/team1` as `"attacker_uid"`.
