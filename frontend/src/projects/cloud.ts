import type { User } from 'firebase/auth';
import {
  addDoc,
  collection,
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
}

export interface ProjectRoomComment {
  id: string;
  project_id: string;
  parent_type: ProjectRoomCommentParent;
  parent_id: string;
  body: string;
  author_uid: string;
  author_label: string;
  created_at: string;
  resolved: boolean;
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
    collection(dbResult.value, 'project_rooms'),
    where('member_uids', 'array-contains', user.uid),
    limit(50),
  );

  return onSnapshot(
    roomsQuery,
    (snapshot) => {
      const rooms = snapshot.docs
        .map((roomDoc) => normalizeCloudRoom(roomDoc.id, roomDoc.data()))
        .filter((room): room is CloudProjectRoom => Boolean(room))
        .sort((a, b) => Date.parse(b.project.updated_at || b.updated_at || '') - Date.parse(a.project.updated_at || a.updated_at || ''));
      onRooms(rooms);
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
    display_name: user.displayName || null,
    role: 'owner',
    joined_at: serverTimestamp(),
  });

  return { ok: true, value: roomId };
}

export async function syncProjectRoom(project: Project, roomId: string, user: User): Promise<CloudResult<string>> {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) return cloudError<string>(dbResult.error);

  await updateDoc(doc(dbResult.value, 'project_rooms', roomId), {
    title: project.title,
    description: project.description,
    status: project.status || 'active',
    next_step: project.next_step || '',
    project,
    member_uids: [user.uid],
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
  const payload = {
    project_id: roomId,
    email: email.trim().toLowerCase(),
    role,
    token,
    status: 'pending',
    created_by: user.uid,
    created_at: createdAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  };
  const ref = await addDoc(collection(dbResult.value, 'project_rooms', roomId, 'invites'), payload);
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
  await updateDoc(doc(dbResult.value, 'project_rooms', roomId, 'invites', inviteId), {
    status: 'revoked',
    revoked_at: serverTimestamp(),
  });
  return { ok: true, value: inviteId };
}

export async function addProjectRoomComment(
  roomId: string,
  parentType: ProjectRoomCommentParent,
  parentId: string,
  body: string,
  user: User,
): Promise<CloudResult<string>> {
  const dbResult = getDbOrError();
  if (!dbResult.ok || !dbResult.value) return cloudError<string>(dbResult.error);
  const createdAt = new Date().toISOString();
  const ref = await addDoc(collection(dbResult.value, 'project_rooms', roomId, 'comments'), {
    project_id: roomId,
    parent_type: parentType,
    parent_id: parentId,
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
    object_type: parentType,
    object_id: parentId,
    summary: `${userLabel(user)} commented on ${parentType}.`,
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
