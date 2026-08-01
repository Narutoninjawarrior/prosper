import type { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreDb } from '../firebaseConfig';
import type { Project } from '../ProjectsPage';

export type ProjectRoomRole = 'owner' | 'editor' | 'reviewer' | 'viewer';
export type ProjectRoomCommentParent = 'project' | 'evidence' | 'decision' | 'commitment' | 'handoff';

export interface ProjectRoomMember {
  uid: string;
  email: string | null;
  display_name: string | null;
  role: ProjectRoomRole;
  joined_at: string;
  moltbook_handle?: string | null;
  moltbook_profile_url?: string | null;
  honor_tier?: string | null;
  skill_tags?: string[];
}

export interface ProjectRoomInvite {
  id: string;
  project_id: string;
  email: string;
  role: Exclude<ProjectRoomRole, 'owner'>;
  token: string;
  status: 'pending' | 'accepted' | 'revoked';
  created_at: string;
  expires_at: string;
  expires_at_ms?: number;
}

export interface ProjectInvitePreview {
  token: string;
  invite_id: string;
  project_id: string;
  project_title: string;
  project_summary: string;
  email: string;
  role: Exclude<ProjectRoomRole, 'owner'>;
  status: 'pending' | 'accepted' | 'revoked';
  created_at: string;
  expires_at: string;
  expires_at_ms?: number;
  accepted_by?: string;
  accepted_at?: string;
}

export interface ProjectInviteAcceptance {
  invite: ProjectInvitePreview;
  room: CloudProjectRoom | null;
}

export interface ProjectRoomComment {
  id: string;
  project_id: string;
  parent_type: ProjectRoomCommentParent;
  parent_id: string;
  parent_comment_id?: string;
  body: string;
  author_uid: string;
  author_label: string;
  created_at: string;
  resolved: boolean;
  optimistic?: boolean;
}

export interface ProjectRoomEvent {
  id: string;
  actor_uid: string;
  actor_label: string;
  action: string;
  object_type: string;
  object_id: string;
  summary: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectRoomPresence {
  uid: string;
  display_name: string;
  status: 'online' | 'offline';
  last_active_ms: number;
}

export interface PublishedHandoff {
  token: string;
  project_id: string;
  project_title: string;
  project_summary: string;
  audience?: string;
  published_at: string;
  published_by: {
    uid: string;
    label: string;
  };
  handoff_version: string;
  markdown: string;
  json: unknown;
  revoked: boolean;
}

export interface CloudProjectRoom {
  id: string;
  title: string;
  description: string;
  client_name?: string;
  status: string;
  next_step?: string;
  owner_uid: string;
  member_uids: string[];
  visibility: 'private' | 'published';
  latest_checkpoint_id?: string;
  current_handoff_token?: string;
  updated_at?: string;
  created_at?: string;
  legacy_project_id?: string;
  project: Project;
}

export interface CloudResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

export interface PermissionSet {
  canManageProject: boolean;
  canEditContent: boolean;
  canReview: boolean;
  canAcceptContext: boolean;
  canPublishHandoff: boolean;
  canComment: boolean;
}

function cloudError<T>(message?: string): CloudResult<T> {
  return { ok: false, error: message || 'Hosted project rooms are unavailable.' };
}

function getDbOrError(): CloudResult<NonNullable<ReturnType<typeof getFirestoreDb>>> {
  const db = getFirestoreDb();
  if (!db) {
    return {
      ok: false,
      error: 'Firebase is not configured. Add Firebase web config before hosted rooms can sync.',
    };
  }
  return { ok: true, value: db };
}

function safeIso(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return undefined;
}

function userLabel(user: User): string {
  return user.displayName || user.email || user.uid;
}

function randomToken(prefix: string) {
  const random = new Uint8Array(18);
  crypto.getRandomValues(random);
  const encoded = Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${encoded}`;
}

export function permissionsForRole(role: ProjectRoomRole): PermissionSet {
  return {
    canManageProject: role === 'owner',
    canEditContent: role === 'owner' || role === 'editor',
    canReview: role === 'owner' || role === 'editor' || role === 'reviewer',
    canAcceptContext: role === 'owner' || role === 'editor',
    canPublishHandoff: role === 'owner',
    canComment: role !== 'viewer',
  };
}

export function normalizeCloudRoom(id: string, data: Record<string, unknown>): CloudProjectRoom | null {
  const project = data.project;
  if (!project || typeof project !== 'object') return null;

  return {
    id,
    title: typeof data.title === 'string' ? data.title : 'Untitled Project Room',
    description: typeof data.description === 'string' ? data.description : '',
    client_name: typeof data.client_name === 'string' ? data.client_name : undefined,
    status: typeof data.status === 'string' ? data.status : 'active',
    next_step: typeof data.next_step === 'string' ? data.next_step : undefined,
    owner_uid: typeof data.owner_uid === 'string' ? data.owner_uid : '',
    member_uids: Array.isArray(data.member_uids) ? data.member_uids.filter((item): item is string => typeof item === 'string') : [],
    visibility: data.visibility === 'published' ? 'published' : 'private',
    latest_checkpoint_id: typeof data.latest_checkpoint_id === 'string' ? data.latest_checkpoint_id : undefined,
    current_handoff_token: typeof data.current_handoff_token === 'string' ? data.current_handoff_token : undefined,
    updated_at: safeIso(data.updated_at),
    created_at: safeIso(data.created_at),
    legacy_project_id: typeof data.legacy_project_id === 'string' ? data.legacy_project_id : undefined,
    project: project as Project,
  };
}

export function listenToHostedProjectRooms(user: User, onRooms: (rooms: CloudProjectRoom[]) => void, onError: (message: string) => void): Unsubscribe | null {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) {
    onError(dbResult.error || 'Hosted rooms are unavailable.');
    return null;
  }

  const roomsQuery = query(
    collectionGroup(dbResult.value, 'members'),
    where('uid', '==', user.uid),
    limit(50),
  );

  return onSnapshot(
    roomsQuery,
    async (snapshot) => {
      const roomSnapshots = await Promise.all(
        snapshot.docs.map((memberDoc) => {
          const roomRef = memberDoc.ref.parent.parent;
          return roomRef ? getDoc(roomRef) : Promise.resolve(null);
        }),
      );
      const rooms = roomSnapshots
        .filter((roomSnapshot): roomSnapshot is NonNullable<typeof roomSnapshot> => Boolean(roomSnapshot?.exists()))
        .map((roomDoc) => normalizeCloudRoom(roomDoc.id, roomDoc.data() as Record<string, unknown>))
        .filter((room): room is CloudProjectRoom => Boolean(room))
        .sort((a, b) => Date.parse(b.project.updated_at || b.updated_at || '') - Date.parse(a.project.updated_at || a.updated_at || ''));
      onRooms(rooms);
    },
    (error) => onError(error.message),
  );
}

export function listenToProjectRoomMembers(roomId: string, onMembers: (members: ProjectRoomMember[]) => void, onError: (message: string) => void): Unsubscribe | null {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) {
    onError(dbResult.error || 'Room members are unavailable.');
    return null;
  }

  return onSnapshot(
    query(collection(dbResult.value, 'project_rooms', roomId, 'members'), limit(50)),
    (snapshot) => {
      onMembers(snapshot.docs.map((memberDoc) => {
        const data = memberDoc.data() as Partial<ProjectRoomMember>;
        return {
          uid: typeof data.uid === 'string' ? data.uid : memberDoc.id,
          email: typeof data.email === 'string' ? data.email : null,
          display_name: typeof data.display_name === 'string' ? data.display_name : null,
          role: data.role === 'owner' || data.role === 'editor' || data.role === 'reviewer' || data.role === 'viewer' ? data.role : 'viewer',
          joined_at: safeIso(data.joined_at) || '',
          moltbook_handle: typeof data.moltbook_handle === 'string' ? data.moltbook_handle : null,
          moltbook_profile_url: typeof data.moltbook_profile_url === 'string' ? data.moltbook_profile_url : null,
          honor_tier: typeof data.honor_tier === 'string' ? data.honor_tier : null,
          skill_tags: Array.isArray(data.skill_tags) ? data.skill_tags.filter((tag): tag is string => typeof tag === 'string') : [],
        };
      }));
    },
    (error) => onError(error.message),
  );
}

export async function importLocalProjectRoom(project: Project, user: User): Promise<CloudResult<string>> {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) return cloudError<string>(dbResult.error);

  const roomId = `room_${project.id}`;
  const roomRef = doc(dbResult.value, 'project_rooms', roomId);
  const existing = await getDoc(roomRef);
  if (existing.exists()) {
    return { ok: true, value: roomId };
  }

  await setDoc(roomRef, {
    title: project.title,
    description: project.description,
    client_name: '',
    status: project.status || 'active',
    next_step: project.next_step || '',
    owner_uid: user.uid,
    member_uids: [user.uid],
    visibility: 'private',
    legacy_project_id: project.id,
    project,
    migration_source: 'hearth_projects',
    migration_timestamp: serverTimestamp(),
    schema_version: 'prosper-room-v1',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  await setDoc(doc(dbResult.value, 'project_rooms', roomId, 'members', user.uid), {
    uid: user.uid,
    email: user.email || null,
    display_name: user.displayName || user.email || 'Project Owner',
    moltbook_handle: null,
    moltbook_profile_url: null,
    honor_tier: null,
    skill_tags: [],
    role: 'owner',
    joined_at: serverTimestamp(),
  });

  return { ok: true, value: roomId };
}

export async function syncProjectRoom(project: Project, roomId: string, user: User): Promise<CloudResult<string>> {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) return cloudError<string>(dbResult.error);

  const roomSnapshot = await getDoc(doc(dbResult.value, 'project_rooms', roomId));
  const existingRoom = roomSnapshot.exists() ? normalizeCloudRoom(roomSnapshot.id, roomSnapshot.data()) : null;

  await updateDoc(doc(dbResult.value, 'project_rooms', roomId), {
    title: project.title,
    description: project.description,
    status: project.status || 'active',
    next_step: project.next_step || '',
    project,
    member_uids: existingRoom?.member_uids?.length ? existingRoom.member_uids : [user.uid],
    updated_at: serverTimestamp(),
  });
  return { ok: true, value: roomId };
}

export async function createProjectRoomInvite(roomId: string, email: string, role: Exclude<ProjectRoomRole, 'owner'>, user: User): Promise<CloudResult<ProjectRoomInvite>> {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) return cloudError<ProjectRoomInvite>(dbResult.error);

  const token = randomToken('invite');
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 1000 * 60 * 60 * 24 * 14);
  const roomSnapshot = await getDoc(doc(dbResult.value, 'project_rooms', roomId));
  const room = roomSnapshot.exists() ? normalizeCloudRoom(roomSnapshot.id, roomSnapshot.data()) : null;
  const payload = {
    project_id: roomId,
    email: email.trim().toLowerCase(),
    role,
    token,
    status: 'pending',
    created_by: user.uid,
    created_at: createdAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    expires_at_ms: expiresAt.getTime(),
  };
  const ref = await addDoc(collection(dbResult.value, 'project_rooms', roomId, 'invites'), payload);
  await setDoc(doc(dbResult.value, 'project_invites', token), {
    ...payload,
    invite_id: ref.id,
    project_title: room?.title || 'Project Room',
    project_summary: room?.description || '',
  });
  return {
    ok: true,
    value: {
      id: ref.id,
      ...payload,
      status: 'pending',
    },
  };
}

export async function listProjectRoomInvites(roomId: string): Promise<CloudResult<ProjectRoomInvite[]>> {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) return cloudError<ProjectRoomInvite[]>(dbResult.error);
  const snapshot = await getDocs(query(collection(dbResult.value, 'project_rooms', roomId, 'invites'), orderBy('created_at', 'desc'), limit(20)));
  return {
    ok: true,
    value: snapshot.docs.map((inviteDoc) => {
      const data = inviteDoc.data() as Omit<ProjectRoomInvite, 'id'>;
      return { id: inviteDoc.id, ...data };
    }),
  };
}

export async function revokeProjectRoomInvite(roomId: string, inviteId: string): Promise<CloudResult<string>> {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) return cloudError<string>(dbResult.error);
  const inviteRef = doc(dbResult.value, 'project_rooms', roomId, 'invites', inviteId);
  const inviteSnapshot = await getDoc(inviteRef);
  await updateDoc(inviteRef, {
    status: 'revoked',
    revoked_at: serverTimestamp(),
  });
  const inviteData = inviteSnapshot.exists() ? inviteSnapshot.data() : null;
  if (typeof inviteData?.token === 'string') {
    await updateDoc(doc(dbResult.value, 'project_invites', inviteData.token), {
      status: 'revoked',
      revoked_at: serverTimestamp(),
    });
  }
  return { ok: true, value: inviteId };
}

export async function fetchProjectInviteByToken(token: string): Promise<CloudResult<ProjectInvitePreview>> {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) return cloudError<ProjectInvitePreview>(dbResult.error);
  const inviteSnapshot = await getDoc(doc(dbResult.value, 'project_invites', token));
  if (!inviteSnapshot.exists()) return { ok: false, error: 'This project invite was not found.' };
  const invite = inviteSnapshot.data() as ProjectInvitePreview;
  if (invite.status === 'revoked') return { ok: false, value: invite, error: 'Invite revoked.' };
  if (invite.status === 'accepted') return { ok: false, value: invite, error: 'Invite already accepted.' };
  if ((invite.expires_at_ms || Date.parse(invite.expires_at)) < Date.now()) return { ok: false, value: invite, error: 'Invite expired.' };
  return { ok: true, value: invite };
}

export async function acceptProjectRoomInvite(token: string, user: User): Promise<CloudResult<ProjectInviteAcceptance>> {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) return cloudError<ProjectInviteAcceptance>(dbResult.error);

  const inviteResult = await fetchProjectInviteByToken(token);
  if (!inviteResult.ok || !inviteResult.value) return cloudError<ProjectInviteAcceptance>(inviteResult.error);
  const invite = inviteResult.value;

  const acceptedAt = new Date().toISOString();
  await setDoc(doc(dbResult.value, 'project_rooms', invite.project_id, 'members', user.uid), {
    uid: user.uid,
    email: user.email || null,
    display_name: user.displayName || user.email || 'Room Member',
    moltbook_handle: null,
    moltbook_profile_url: null,
    honor_tier: null,
    skill_tags: [],
    role: invite.role,
    invite_token: token,
    joined_at: acceptedAt,
  });
  await updateDoc(doc(dbResult.value, 'project_invites', token), {
    status: 'accepted',
    accepted_by: user.uid,
    accepted_at: acceptedAt,
  });
  await updateDoc(doc(dbResult.value, 'project_rooms', invite.project_id, 'invites', invite.invite_id), {
    status: 'accepted',
    accepted_by: user.uid,
    accepted_at: acceptedAt,
  });
  await addDoc(collection(dbResult.value, 'project_rooms', invite.project_id, 'events'), {
    actor_uid: user.uid,
    actor_label: userLabel(user),
    action: 'member_joined',
    object_type: 'member',
    object_id: user.uid,
    summary: `${userLabel(user)} joined as ${invite.role}.`,
    timestamp: acceptedAt,
  });

  const roomSnapshot = await getDoc(doc(dbResult.value, 'project_rooms', invite.project_id));
  const room = roomSnapshot.exists() ? normalizeCloudRoom(roomSnapshot.id, roomSnapshot.data()) : null;
  return { ok: true, value: { invite, room } };
}

export async function addProjectRoomComment(
  roomId: string,
  parentType: ProjectRoomCommentParent,
  parentId: string,
  body: string,
  user: User,
  parentCommentId?: string,
): Promise<CloudResult<string>> {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) return cloudError<string>(dbResult.error);
  const createdAt = new Date().toISOString();
  const ref = await addDoc(collection(dbResult.value, 'project_rooms', roomId, 'comments'), {
    project_id: roomId,
    parent_type: parentType,
    parent_id: parentId,
    parent_comment_id: parentCommentId || null,
    body: body.trim(),
    author_uid: user.uid,
    author_label: userLabel(user),
    created_at: createdAt,
    resolved: false,
  });
  await addDoc(collection(dbResult.value, 'project_rooms', roomId, 'events'), {
    actor_uid: user.uid,
    actor_label: userLabel(user),
    action: 'comment_added',
    object_type: parentCommentId ? 'comment' : parentType,
    object_id: parentCommentId || parentId,
    summary: parentCommentId ? `${userLabel(user)} replied to a comment.` : `${userLabel(user)} commented on ${parentType}.`,
    timestamp: createdAt,
  });
  return { ok: true, value: ref.id };
}

export function listenToProjectRoomComments(roomId: string, onComments: (comments: ProjectRoomComment[]) => void, onError: (message: string) => void): Unsubscribe | null {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) {
    onError(dbResult.error || 'Comments are unavailable.');
    return null;
  }
  return onSnapshot(
    query(collection(dbResult.value, 'project_rooms', roomId, 'comments'), orderBy('created_at', 'desc'), limit(50)),
    (snapshot) => {
      onComments(snapshot.docs.map((commentDoc) => ({ id: commentDoc.id, ...(commentDoc.data() as Omit<ProjectRoomComment, 'id'>) })));
    },
    (error) => onError(error.message),
  );
}

export function listenToProjectRoomEvents(roomId: string, onEvents: (events: ProjectRoomEvent[]) => void, onError: (message: string) => void): Unsubscribe | null {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) {
    onError(dbResult.error || 'Events are unavailable.');
    return null;
  }
  return onSnapshot(
    query(collection(dbResult.value, 'project_rooms', roomId, 'events'), orderBy('timestamp', 'desc'), limit(75)),
    (snapshot) => {
      onEvents(snapshot.docs.map((eventDoc) => ({ id: eventDoc.id, ...(eventDoc.data() as Omit<ProjectRoomEvent, 'id'>) })));
    },
    (error) => onError(error.message),
  );
}

export function listenToProjectRoomPresence(roomId: string, onPresence: (presence: ProjectRoomPresence[]) => void, onError: (message: string) => void): Unsubscribe | null {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) {
    onError(dbResult.error || 'Presence is unavailable.');
    return null;
  }
  return onSnapshot(
    query(collection(dbResult.value, 'project_rooms', roomId, 'presence'), orderBy('last_active_ms', 'desc'), limit(50)),
    (snapshot) => {
      onPresence(snapshot.docs.map((presenceDoc) => {
        const data = presenceDoc.data() as Partial<ProjectRoomPresence>;
        return {
          uid: typeof data.uid === 'string' ? data.uid : presenceDoc.id,
          display_name: typeof data.display_name === 'string' ? data.display_name : presenceDoc.id,
          status: data.status === 'offline' ? 'offline' : 'online',
          last_active_ms: typeof data.last_active_ms === 'number' ? data.last_active_ms : 0,
        };
      }));
    },
    (error) => onError(error.message),
  );
}

export async function writeProjectRoomPresence(roomId: string, user: User, status: 'online' | 'offline' = 'online'): Promise<CloudResult<string>> {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) return cloudError<string>(dbResult.error);
  await setDoc(
    doc(dbResult.value, 'project_rooms', roomId, 'presence', user.uid),
    {
      uid: user.uid,
      display_name: userLabel(user),
      status,
      last_active_ms: Date.now(),
      updated_at: serverTimestamp(),
    },
    { merge: true },
  );
  return { ok: true, value: user.uid };
}

export async function publishProjectHandoff(
  roomId: string,
  project: Project,
  markdown: string,
  json: unknown,
  user: User,
): Promise<CloudResult<PublishedHandoff>> {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) return cloudError<PublishedHandoff>(dbResult.error);

  const token = randomToken('handoff');
  const publishedAt = new Date().toISOString();
  const payload: PublishedHandoff = {
    token,
    project_id: roomId,
    project_title: project.title,
    project_summary: project.description || project.pinned_note || '',
    audience: project.category,
    published_at: publishedAt,
    published_by: {
      uid: user.uid,
      label: userLabel(user),
    },
    handoff_version: `v${(project.review_packets || []).length + 1}`,
    markdown,
    json,
    revoked: false,
  };

  await setDoc(doc(dbResult.value, 'published_handoffs', token), payload);
  await updateDoc(doc(dbResult.value, 'project_rooms', roomId), {
    visibility: 'published',
    current_handoff_token: token,
    updated_at: serverTimestamp(),
  });
  await addDoc(collection(dbResult.value, 'project_rooms', roomId, 'events'), {
    actor_uid: user.uid,
    actor_label: userLabel(user),
    action: 'handoff_published',
    object_type: 'handoff',
    object_id: token,
    summary: `Handoff published for ${project.title}.`,
    timestamp: publishedAt,
  });

  return { ok: true, value: payload };
}

export async function revokePublishedHandoff(roomId: string, token: string, user: User): Promise<CloudResult<string>> {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) return cloudError<string>(dbResult.error);
  await updateDoc(doc(dbResult.value, 'published_handoffs', token), {
    revoked: true,
    revoked_at: serverTimestamp(),
    revoked_by: user.uid,
  });
  await updateDoc(doc(dbResult.value, 'project_rooms', roomId), {
    visibility: 'private',
    current_handoff_token: '',
    updated_at: serverTimestamp(),
  });
  return { ok: true, value: token };
}

export async function fetchPublishedHandoff(token: string): Promise<CloudResult<PublishedHandoff>> {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) return cloudError<PublishedHandoff>(dbResult.error);
  const snapshot = await getDoc(doc(dbResult.value, 'published_handoffs', token));
  if (!snapshot.exists()) return { ok: false, error: 'This handoff link was not found.' };
  const handoff = snapshot.data() as PublishedHandoff;
  if (handoff.revoked) return { ok: false, error: 'This handoff link has been revoked.' };
  return { ok: true, value: handoff };
}

export async function deleteHostedRoom(roomId: string): Promise<CloudResult<string>> {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) return cloudError<string>(dbResult.error);
  await deleteDoc(doc(dbResult.value, 'project_rooms', roomId));
  return { ok: true, value: roomId };
}
