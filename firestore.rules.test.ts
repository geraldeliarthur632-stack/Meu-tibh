/**
 * Payload-First Security TDD specification for Meu Time Firestore Rules.
 * Documents the 12 "Dirty Dozen" adversarial payloads verified against firestore.rules.
 */
export interface DirtyDozenCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  authContext: { uid: string | null; emailVerified: boolean };
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Team Creation',
    collectionPath: '/teams/team_01',
    operation: 'create',
    authContext: { uid: null, emailVerified: false },
    payload: { id: 'team_01', name: 'FC Studio', sport: 'futebol', ownerId: 'anon' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Team Creation',
    collectionPath: '/teams/team_02',
    operation: 'create',
    authContext: { uid: 'user_unverified', emailVerified: false },
    payload: { id: 'team_02', name: 'FC Studio', sport: 'futebol', ownerId: 'user_unverified' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing on Team Create',
    collectionPath: '/teams/team_03',
    operation: 'create',
    authContext: { uid: 'attacker_uid', emailVerified: true },
    payload: { id: 'team_03', name: 'FC Spoof', sport: 'futsal', ownerId: 'victim_uid' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Ghost Field Injection',
    collectionPath: '/teams/team_04',
    operation: 'create',
    authContext: { uid: 'attacker_uid', emailVerified: true },
    payload: { id: 'team_04', name: 'FC Ghost', sport: 'basquete', ownerId: 'attacker_uid', isAdmin: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Oversized ID Poisoning',
    collectionPath: `/teams/${'a'.repeat(140)}`,
    operation: 'create',
    authContext: { uid: 'attacker_uid', emailVerified: true },
    payload: { id: 'a'.repeat(140), name: 'Poison' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Non-Member Chat Injection',
    collectionPath: '/teams/team_01/messages/msg_01',
    operation: 'create',
    authContext: { uid: 'outsider_uid', emailVerified: true },
    payload: { id: 'msg_01', teamId: 'team_01', senderId: 'outsider_uid', text: 'Spam' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Chat Sender Spoofing',
    collectionPath: '/teams/team_01/messages/msg_02',
    operation: 'create',
    authContext: { uid: 'member_a', emailVerified: true },
    payload: { id: 'msg_02', teamId: 'team_01', senderId: 'member_b', text: 'Fake' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Unauthorized Join Without Valid Invite',
    collectionPath: '/teams/team_01/members/attacker_uid',
    operation: 'create',
    authContext: { uid: 'attacker_uid', emailVerified: true },
    payload: { id: 'attacker_uid', teamId: 'team_01', userId: 'attacker_uid', role: 'member', inviteCode: 'FAKE99' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Invite Code Enumeration via List',
    collectionPath: '/invites',
    operation: 'list',
    authContext: { uid: 'attacker_uid', emailVerified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Post-Finish Match Tampering',
    collectionPath: '/teams/team_01/matches/match_finished',
    operation: 'update',
    authContext: { uid: 'member_a', emailVerified: true },
    payload: { teamScore: 99, status: 'live' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Client Timestamp Forgery',
    collectionPath: '/teams/team_01/messages/msg_03',
    operation: 'create',
    authContext: { uid: 'member_a', emailVerified: true },
    payload: { id: 'msg_03', teamId: 'team_01', senderId: 'member_a', text: 'Hi', createdAt: '2020-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Cross-User Membership Hijack',
    collectionPath: '/users/victim_uid/teamMemberships/team_01',
    operation: 'get',
    authContext: { uid: 'attacker_uid', emailVerified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
