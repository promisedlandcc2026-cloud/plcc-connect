import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Hand,
  Link2,
  Loader2,
  Lock,
  Mic,
  MicOff,
  PhoneOff,
  Share2,
  Users,
  Video,
  VideoOff,
  Volume2,
  X,
} from 'lucide-react';
import {
  Room,
  RoomEvent,
  Track,
  type LocalParticipant,
  type LocalTrackPublication,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type TrackPublication,
  DisconnectReason,
} from 'livekit-client';
import {
  createFamilyHuddleInvite,
  endFamilyHuddle,
  fetchFamilyHuddleToken,
  lockFamilyHuddleInvites,
} from '../../lib/familyHuddleClient';
import {
  FamilyHuddleError,
  type FamilyHuddleInvite,
  type FamilyHuddleJoinToken,
} from '../../lib/familyHuddleTypes';
import {
  appendHuddleChatMessage,
  buildHuddleChatWirePayload,
  createHuddleChatId,
  decodeIncomingHuddleChat,
  encodeHuddleChatPayload,
  HUDDLE_CHAT_TOPIC,
  hydrateHuddleChatMessage,
  type HuddleChatMessage,
} from '../../lib/huddleChat';
import {
  HUDDLE_HOST_MUTE_NOTICE,
  huddleMicrophonePublishAllowed,
  mergeHandMetadata,
  parseHandRaised,
  sortTilesRaisedFirst,
  syncRosterFromTiles,
  type HuddleRosterEntry,
} from '../../lib/huddlePresence';
import { useScreenWakeLock } from '../../lib/useScreenWakeLock';
import { HuddleChatPanel } from '../huddle/HuddleChatPanel';
import { HuddleHandsPanel } from '../huddle/HuddleHandsPanel';
import {
  HuddleMobileTabs,
  type HuddleMobileTabId,
} from '../huddle/HuddleMobileTabs';
import { HuddlePeoplePanel } from '../huddle/HuddlePeoplePanel';
import { HuddleTabSheet } from '../huddle/HuddleTabSheet';

/** LiveKit closed this copy on purpose (joined elsewhere, removed, or ended): do not auto-rejoin. */
function huddleDisconnectIsFinal(reason?: DisconnectReason): boolean {
  return (
    reason === DisconnectReason.DUPLICATE_IDENTITY ||
    reason === DisconnectReason.PARTICIPANT_REMOVED ||
    reason === DisconnectReason.ROOM_DELETED
  );
}

function huddleDisconnectMessage(reason?: DisconnectReason): string {
  if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
    return 'You joined this huddle somewhere else (another tab, app or device). Tap Join to bring it back here.';
  }
  if (reason === DisconnectReason.PARTICIPANT_REMOVED) return 'You were removed from the huddle.';
  return 'The huddle has ended.';
}

type ConnState = 'prejoin' | 'connecting' | 'reconnecting' | 'connected' | 'error';

const MAX_HUDDLE_RECONNECTS = 3;

type Tile = {
  identity: string;
  name: string;
  isLocal: boolean;
  micOn: boolean;
  camOn: boolean;
  handRaised: boolean;
  speaking: boolean;
};

type Props = {
  mode?: 'join' | 'start';
  householdName?: string | null;
  /** Guest: already redeemed token — skip mint / no end for everyone */
  guestToken?: FamilyHuddleJoinToken | null;
  onClose: () => void;
};

function displayName(p: Participant): string {
  return (p.name || p.identity || 'Family').trim() || 'Family';
}

function inviteExpiryLabel(expiresAt: string | null): string {
  if (!expiresAt) return 'Expires in 2 hours';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'Expired';
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `Expires in ${h}h ${m}m` : `Expires in ${h}h`;
  }
  return `Expires in ${mins}m`;
}

function ParticipantVideo({
  participant,
  isLocal,
  camOn,
}: {
  participant: Participant;
  isLocal: boolean;
  camOn: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (!camOn) {
      el.srcObject = null;
      return undefined;
    }
    const pub = participant.getTrackPublication(Track.Source.Camera);
    const track = pub?.track;
    if (track && !pub.isMuted) {
      track.attach(el);
      return () => {
        track.detach(el);
      };
    }
    el.srcObject = null;
    return undefined;
  }, [participant, camOn, isLocal]);

  return (
    <video
      ref={videoRef}
      className={`absolute inset-0 z-0 h-full w-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
      playsInline
      muted={isLocal}
      autoPlay
    />
  );
}

export const FamilyVoiceHuddle: React.FC<Props> = ({
  mode = 'join',
  householdName,
  guestToken = null,
  onClose,
}) => {
  const isGuest = Boolean(guestToken);
  const [conn, setConn] = useState<ConnState>(guestToken ? 'connecting' : 'prejoin');
  const [error, setError] = useState<string | null>(null);
  const [hostMuteNotice, setHostMuteNotice] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const [camEnabled, setCamEnabled] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [needSoundTap, setNeedSoundTap] = useState(false);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [roster, setRoster] = useState<HuddleRosterEntry[]>([]);
  const [activeTab, setActiveTab] = useState<HuddleMobileTabId | null>(null);
  const [chatMessages, setChatMessages] = useState<HuddleChatMessage[]>([]);
  const [chatUnread, setChatUnread] = useState(0);
  const [chatSending, setChatSending] = useState(false);
  const [title, setTitle] = useState(householdName || 'Family Huddle');
  const [canModerate, setCanModerate] = useState(!isGuest);
  const [ending, setEnding] = useState(false);
  const [invite, setInvite] = useState<FamilyHuddleInvite | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [invitesLocked, setInvitesLocked] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const joinInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const autoJoinedRef = useRef(false);
  const leaveIntentionalRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const joinRef = useRef<() => Promise<void>>(async () => {});
  /** Dropped while the phone slept or the member switched apps — rejoin when they're back. */
  const lostConnectionRef = useRef(false);
  const canModerateRef = useRef(!isGuest);
  const activeTabRef = useRef<HuddleMobileTabId | null>(null);
  const micEnabledRef = useRef(false);
  const selfMuteIntentRef = useRef(false);

  useEffect(() => {
    canModerateRef.current = canModerate;
  }, [canModerate]);
  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);
  useEffect(() => {
    activeTabRef.current = activeTab;
    if (activeTab === 'chat') setChatUnread(0);
  }, [activeTab]);

  useScreenWakeLock(
    conn === 'connected' || conn === 'connecting' || conn === 'reconnecting'
  );

  const clearRemoteAudio = useCallback(() => {
    for (const el of audioElsRef.current.values()) {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch {
        /* ignore */
      }
    }
    audioElsRef.current.clear();
  }, []);

  const attachRemoteAudio = useCallback((identity: string, track: RemoteTrack) => {
    let el = audioElsRef.current.get(identity);
    if (!el) {
      el = document.createElement('audio');
      el.autoplay = true;
      el.setAttribute('playsinline', 'true');
      el.style.display = 'none';
      document.body.appendChild(el);
      audioElsRef.current.set(identity, el);
    }
    track.attach(el);
    const play = el.play();
    if (play && typeof play.then === 'function') {
      play.catch(() => {
        if (mountedRef.current) setNeedSoundTap(true);
      });
    }
  }, []);

  const refreshTiles = useCallback((room: Room) => {
    if (!mountedRef.current) return;
    const speakers = new Set(room.activeSpeakers.map((p) => p.identity));
    const next: Tile[] = [];

    const push = (p: Participant, isLocal: boolean) => {
      const micPub = p.getTrackPublication(Track.Source.Microphone);
      const camPub = p.getTrackPublication(Track.Source.Camera);
      next.push({
        identity: p.identity,
        name: displayName(p),
        isLocal,
        micOn: Boolean(micPub?.track && !micPub.isMuted),
        camOn: Boolean(camPub?.track && !camPub.isMuted),
        handRaised: parseHandRaised(p.metadata),
        speaking: speakers.has(p.identity),
      });
    };

    push(room.localParticipant, true);
    const remotes = Array.from(room.remoteParticipants.values()).sort((a, b) =>
      displayName(a).localeCompare(displayName(b))
    );
    for (const r of remotes) push(r, false);
    const sorted = sortTilesRaisedFirst(next);
    setTiles(sorted);
    setRoster((prev) => syncRosterFromTiles(prev, sorted));
  }, []);

  const disconnectRoom = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    clearRemoteAudio();
    if (room) {
      try {
        await room.disconnect(true);
      } catch {
        /* ignore */
      }
    }
  }, [clearRemoteAudio]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void disconnectRoom();
    };
  }, [disconnectRoom]);

  const enableSound = useCallback(async () => {
    let unlocked = true;
    for (const el of audioElsRef.current.values()) {
      try {
        await el.play();
      } catch {
        unlocked = false;
      }
    }
    if (unlocked) setNeedSoundTap(false);
  }, []);

  const connectWithToken = useCallback(
    async (tokenPayload: FamilyHuddleJoinToken, opts?: { reconnect?: boolean }) => {
      if (joinInFlightRef.current || roomRef.current) return;
      joinInFlightRef.current = true;
      leaveIntentionalRef.current = false;
      const reconnecting = Boolean(opts?.reconnect);
      setConn(reconnecting ? 'reconnecting' : 'connecting');
      setError(null);
      if (!reconnecting) {
        setRoster([]);
        setChatMessages([]);
        setChatUnread(0);
        setActiveTab(null);
      }
      try {
        if (!mountedRef.current) return;
        setTitle(
          tokenPayload.householdName || householdName || 'Family Huddle'
        );
        setCanModerate(Boolean(tokenPayload.canModerate) && !tokenPayload.isGuest);

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        const onChange = () => refreshTiles(room);

        room
          .on(RoomEvent.ParticipantConnected, onChange)
          .on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
            const el = audioElsRef.current.get(p.identity);
            if (el) {
              try {
                el.pause();
                el.srcObject = null;
                el.remove();
              } catch {
                /* ignore */
              }
              audioElsRef.current.delete(p.identity);
            }
            onChange();
          })
          .on(RoomEvent.ParticipantMetadataChanged, onChange)
          .on(RoomEvent.ActiveSpeakersChanged, onChange)
          .on(RoomEvent.TrackMuted, (pub: TrackPublication, participant) => {
            if (participant?.isLocal && pub.source === Track.Source.Microphone) {
              setMicEnabled(false);
              micEnabledRef.current = false;
              if (!selfMuteIntentRef.current && micEnabledRef.current) {
                setHostMuteNotice(HUDDLE_HOST_MUTE_NOTICE);
              }
            }
            onChange();
          })
          .on(RoomEvent.TrackUnmuted, (pub: TrackPublication, participant) => {
            if (participant?.isLocal && pub.source === Track.Source.Microphone) {
              setMicEnabled(true);
              micEnabledRef.current = true;
              setHostMuteNotice(null);
            }
            onChange();
          })
          .on(RoomEvent.ParticipantPermissionsChanged, (_prev, participant) => {
            if (!participant?.isLocal) return;
            if (!huddleMicrophonePublishAllowed(participant.permissions)) {
              void room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
              setMicEnabled(false);
              micEnabledRef.current = false;
              setHostMuteNotice(HUDDLE_HOST_MUTE_NOTICE);
            }
            onChange();
          })
          .on(RoomEvent.LocalTrackPublished, onChange)
          .on(RoomEvent.LocalTrackUnpublished, (pub: LocalTrackPublication) => {
            if (pub.source === Track.Source.Microphone) {
              setMicEnabled(false);
              micEnabledRef.current = false;
            }
            onChange();
          })
          .on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
            if (!mountedRef.current || !participant) return;
            const msg = decodeIncomingHuddleChat({
              bytes: payload,
              senderIdentity: participant.identity,
              senderName: displayName(participant),
              localIdentity: room.localParticipant.identity,
              localCanModerate: canModerateRef.current,
              topic: topic ?? null,
            });
            if (!msg) return;
            setChatMessages((prev) => appendHuddleChatMessage(prev, msg));
            if (activeTabRef.current !== 'chat' && !msg.isLocal) {
              setChatUnread((n) => n + 1);
            }
          })
          .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, participant) => {
            if (track.kind === Track.Kind.Audio) {
              attachRemoteAudio(participant.identity, track);
            }
            onChange();
          })
          .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub, participant) => {
            if (track.kind === Track.Kind.Audio) {
              const el = audioElsRef.current.get(participant.identity);
              try {
                track.detach();
                if (el) el.srcObject = null;
              } catch {
                /* ignore */
              }
            }
            onChange();
          })
          .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
            if (!mountedRef.current) return;
            clearRemoteAudio();
            roomRef.current = null;
            setTiles([]);
            if (leaveIntentionalRef.current) {
              setRoster([]);
              setChatMessages([]);
              setChatUnread(0);
              setActiveTab(null);
              setConn('prejoin');
              return;
            }
            if (huddleDisconnectIsFinal(reason)) {
            lostConnectionRef.current = true;
            setError(huddleDisconnectMessage(reason));
            setConn('error');
            return;
          }
          if (reconnectAttemptsRef.current >= MAX_HUDDLE_RECONNECTS) {
              lostConnectionRef.current = true;
              setError('Connection lost. Tap to rejoin Family Huddle.');
              setConn('error');
              return;
            }
            reconnectAttemptsRef.current += 1;
            setConn('reconnecting');
            window.setTimeout(() => {
              if (!mountedRef.current || leaveIntentionalRef.current) return;
              void joinRef.current();
            }, 600);
          });

        await room.connect(tokenPayload.url, tokenPayload.token);
        if (!mountedRef.current) {
          await room.disconnect(true);
          return;
        }

        // Join muted. The member turns their own mic on when they are ready.
        selfMuteIntentRef.current = true;
        try {
          await room.localParticipant.setMicrophoneEnabled(false);
        } finally {
          selfMuteIntentRef.current = false;
        }
        setMicEnabled(false);
        micEnabledRef.current = false;
        if (camEnabled) {
          try {
            await room.localParticipant.setCameraEnabled(true);
          } catch {
            setError('Camera could not be enabled. You can still join with audio.');
          }
        }

        for (const p of room.remoteParticipants.values()) {
          for (const pub of p.trackPublications.values()) {
            if (pub.kind === Track.Kind.Audio && pub.track) {
              attachRemoteAudio(p.identity, pub.track as RemoteTrack);
            }
          }
        }

        refreshTiles(room);
        reconnectAttemptsRef.current = 0;
        lostConnectionRef.current = false;
        setConn('connected');
        setHandRaised(parseHandRaised(room.localParticipant.metadata));
      } catch (err) {
        await disconnectRoom();
        if (!mountedRef.current) return;
        const message =
          err instanceof FamilyHuddleError
            ? err.message
            : 'Could not join Family Huddle. Please try again.';
        setError(message);
        setConn('error');
      } finally {
        joinInFlightRef.current = false;
      }
    },
    [
      attachRemoteAudio,
      camEnabled,
      clearRemoteAudio,
      disconnectRoom,
      householdName,
      refreshTiles,
    ]
  );

  const join = useCallback(
    async (opts?: { reconnect?: boolean }) => {
      const reconnecting = Boolean(opts?.reconnect);
      if (reconnecting) setConn('reconnecting');
      if (guestToken) {
        await connectWithToken(guestToken, { reconnect: reconnecting });
        return;
      }
      try {
        const tokenPayload = await fetchFamilyHuddleToken();
        await connectWithToken(tokenPayload, { reconnect: reconnecting });
      } catch (err) {
        if (!mountedRef.current) return;
        const message =
          err instanceof FamilyHuddleError
            ? err.message
            : 'Could not join Family Huddle. Please try again.';
        setError(message);
        setConn('error');
      }
    },
    [connectWithToken, guestToken]
  );

  useEffect(() => {
    joinRef.current = () => join({ reconnect: true });
  }, [join]);

  // Phones drop the call when the screen sleeps or the member switches tabs.
  // When they come back, rejoin on their own instead of leaving them kicked out.
  useEffect(() => {
    const onBack = () => {
      if (document.visibilityState !== 'visible') return;
      if (!mountedRef.current || leaveIntentionalRef.current || !lostConnectionRef.current) return;
      lostConnectionRef.current = false;
      reconnectAttemptsRef.current = 0;
      setError(null);
      setConn('reconnecting');
      void joinRef.current();
    };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('pageshow', onBack);
    window.addEventListener('online', onBack);
    return () => {
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('pageshow', onBack);
      window.removeEventListener('online', onBack);
    };
  }, []);

  useEffect(() => {
    if (!guestToken || autoJoinedRef.current) return;
    autoJoinedRef.current = true;
    void join();
  }, [guestToken, join]);

  const leave = useCallback(async () => {
    leaveIntentionalRef.current = true;
    reconnectAttemptsRef.current = MAX_HUDDLE_RECONNECTS;
    await disconnectRoom();
    setConn('prejoin');
    setTiles([]);
    setRoster([]);
    setChatMessages([]);
    setChatUnread(0);
    setActiveTab(null);
    setHandRaised(false);
    onClose();
  }, [disconnectRoom, onClose]);

  const endForEveryone = useCallback(async () => {
    if (!canModerate || ending || isGuest) return;
    const ok = window.confirm(
      'End this Family Huddle for everyone? All participants will be disconnected.'
    );
    if (!ok) return;
    setEnding(true);
    setError(null);
    leaveIntentionalRef.current = true;
    reconnectAttemptsRef.current = MAX_HUDDLE_RECONNECTS;
    try {
      await endFamilyHuddle();
      await disconnectRoom();
      setConn('prejoin');
      setTiles([]);
      setRoster([]);
      setChatMessages([]);
      setChatUnread(0);
      setActiveTab(null);
      setHandRaised(false);
      onClose();
    } catch (err) {
      const message =
        err instanceof FamilyHuddleError
          ? err.message
          : 'Could not end Family Huddle. Please try again.';
      setError(message);
    } finally {
      setEnding(false);
    }
  }, [canModerate, disconnectRoom, ending, isGuest, onClose]);

  const ensureInvite = useCallback(async () => {
    if (invite || inviteBusy || isGuest) return invite;
    setInviteBusy(true);
    setError(null);
    try {
      const created = await createFamilyHuddleInvite();
      setInvite(created);
      return created;
    } catch (err) {
      const message =
        err instanceof FamilyHuddleError
          ? err.message
          : 'Could not create invite link.';
      setError(message);
      return null;
    } finally {
      setInviteBusy(false);
    }
  }, [invite, inviteBusy, isGuest]);

  const absoluteInviteUrl = useCallback((path: string) => {
    if (typeof window === 'undefined') return path;
    return `${window.location.origin}${path}`;
  }, []);

  const copyInvite = useCallback(async () => {
    const created = invite || (await ensureInvite());
    if (!created) return;
    const url = absoluteInviteUrl(created.path);
    try {
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      setError('Could not copy the link. Try sharing instead.');
    }
  }, [absoluteInviteUrl, ensureInvite, invite]);

  const shareInvite = useCallback(async () => {
    const created = invite || (await ensureInvite());
    if (!created) return;
    const url = absoluteInviteUrl(created.path);
    const text = `Join our Family Huddle on PLCC Connect (${inviteExpiryLabel(created.expiresAt)})`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Family Huddle', text, url });
        return;
      }
    } catch {
      /* fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      setError('Could not share the invite link.');
    }
  }, [absoluteInviteUrl, ensureInvite, invite]);

  const lockInvites = useCallback(async () => {
    if (lockBusy || isGuest || invitesLocked) return;
    setLockBusy(true);
    setError(null);
    try {
      await lockFamilyHuddleInvites();
      setInvitesLocked(true);
    } catch (err) {
      const message =
        err instanceof FamilyHuddleError
          ? err.message
          : 'Could not lock invites.';
      setError(message);
    } finally {
      setLockBusy(false);
    }
  }, [invitesLocked, isGuest, lockBusy]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) {
      setMicEnabled((v) => !v);
      return;
    }
    const next = !micEnabled;
    if (next && !huddleMicrophonePublishAllowed(room.localParticipant.permissions)) {
      setMicEnabled(false);
      micEnabledRef.current = false;
      setHostMuteNotice(HUDDLE_HOST_MUTE_NOTICE);
      return;
    }
    selfMuteIntentRef.current = true;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicEnabled(next);
      micEnabledRef.current = next;
      if (next) setHostMuteNotice(null);
      refreshTiles(room);
    } catch {
      if (next) {
        setMicEnabled(false);
        micEnabledRef.current = false;
        setHostMuteNotice(HUDDLE_HOST_MUTE_NOTICE);
      } else {
        setError('Could not change microphone.');
      }
    } finally {
      selfMuteIntentRef.current = false;
    }
  }, [micEnabled, refreshTiles]);

  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    if (!room) {
      setCamEnabled((v) => !v);
      return;
    }
    const next = !camEnabled;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCamEnabled(next);
      refreshTiles(room);
    } catch {
      setError('Camera permission is required to turn video on.');
    }
  }, [camEnabled, refreshTiles]);

  const toggleHand = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const local: LocalParticipant = room.localParticipant;
    const next = !handRaised;
    try {
      await local.setMetadata(mergeHandMetadata(local.metadata, next));
      setHandRaised(next);
      refreshTiles(room);
    } catch {
      setError('Could not update hand raise.');
    }
  }, [handRaised, refreshTiles]);

  const sendChat = useCallback(async (text: string) => {
    const room = roomRef.current;
    if (!room) return;
    const local = room.localParticipant;
    const wire = buildHuddleChatWirePayload({
      id: createHuddleChatId(),
      text,
    });
    if (!wire) return;
    setChatSending(true);
    try {
      await local.publishData(encodeHuddleChatPayload(wire), {
        reliable: true,
        topic: HUDDLE_CHAT_TOPIC,
      });
      const localMsg = hydrateHuddleChatMessage({
        payload: wire,
        senderIdentity: local.identity,
        senderName: displayName(local),
        localIdentity: local.identity,
        localCanModerate: canModerateRef.current,
      });
      if (localMsg) {
        setChatMessages((prev) => appendHuddleChatMessage(prev, localMsg));
      }
    } catch {
      setError('Could not send huddle chat message.');
    } finally {
      setChatSending(false);
    }
  }, []);

  const participantFor = (identity: string): Participant | null => {
    const room = roomRef.current;
    if (!room) return null;
    if (room.localParticipant.identity === identity) return room.localParticipant;
    return room.remoteParticipants.get(identity) || null;
  };

  const raisedNames = useMemo(
    () => tiles.filter((t) => t.handRaised).map((t) => (t.isLocal ? `${t.name} (you)` : t.name)),
    [tiles]
  );
  const raisedEntries = useMemo(
    () =>
      tiles
        .filter((t) => t.handRaised)
        .map((t) => ({ identity: t.identity, name: t.name, isLocal: t.isLocal })),
    [tiles]
  );
  const inCount = roster.filter((e) => e.status === 'in').length;

  const inviteFooter =
    !isGuest ? (
      <div className="space-y-2">
        <p className="text-xs text-white/60 leading-relaxed">
          Share a guest link (expires in 2 hours). Guests enter a name — they are not added to your household.
        </p>
        {invite ? (
          <p className="text-xs text-gold font-medium">
            {inviteExpiryLabel(invite.expiresAt)} · up to {invite.maxUses} guests
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void shareInvite()}
            disabled={inviteBusy}
            className="flex-1 min-h-[40px] rounded-xl bg-gold text-burgundy text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Share2 size={14} aria-hidden />
            Share
          </button>
          <button
            type="button"
            onClick={() => void copyInvite()}
            disabled={inviteBusy}
            className="flex-1 min-h-[40px] rounded-xl bg-white/10 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {inviteCopied ? <Link2 size={14} /> : <Copy size={14} />}
            {inviteCopied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => void lockInvites()}
          disabled={lockBusy || invitesLocked}
          className="w-full min-h-[36px] text-xs font-bold text-white/70 flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Lock size={12} aria-hidden />
          {invitesLocked ? 'Invites locked' : lockBusy ? 'Locking…' : 'Lock new guest joins'}
        </button>
      </div>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-[400] flex flex-col bg-[#0f0a0c] text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Family Huddle"
    >
      <header className="flex items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 border-b border-white/10">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-gold">
            Family only · no recording
          </p>
          <h2 className="text-sm font-bold truncate">{title}</h2>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {conn === 'connected' ? (
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className="min-h-[44px] px-3 rounded-full bg-white/10 flex items-center justify-center gap-1.5"
              aria-label={`Attendance, ${inCount} in huddle`}
            >
              <Users size={18} aria-hidden />
              <span className="text-xs font-bold tabular-nums">{inCount || tiles.length}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void leave()}
            className="min-h-[44px] min-w-[44px] rounded-full bg-white/10 flex items-center justify-center"
            aria-label="Close Family Huddle"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
      </header>

      {needSoundTap ? (
        <button
          type="button"
          onClick={() => void enableSound()}
          className="mx-3 mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gold text-burgundy font-bold text-sm min-h-[44px]"
        >
          <Volume2 size={18} aria-hidden />
          Enable sound
        </button>
      ) : null}

      {hostMuteNotice ? (
        <p className="mx-3 mt-2 rounded-2xl bg-burgundy px-4 py-3 text-sm text-white leading-relaxed" role="status">
          {hostMuteNotice}
        </p>
      ) : null}

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {conn === 'prejoin' || conn === 'error' ? (
          <div className="max-w-md mx-auto space-y-4 pt-6">
            <p className="text-sm text-white/70 text-center leading-relaxed">
              {mode === 'start'
                ? 'Start a private Family Huddle for household adults. Share a link for guests — dependents stay off video in this version.'
                : 'Join your family’s live room. Mute and camera controls are available.'}
            </p>
            {error ? (
              <p className="text-sm text-red-300 text-center font-medium">{error}</p>
            ) : null}
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => void toggleMic()}
                className={`min-h-[44px] min-w-[44px] rounded-2xl flex items-center justify-center ${
                  micEnabled ? 'bg-white/15' : 'bg-burgundy'
                }`}
                aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
                aria-pressed={!micEnabled}
              >
                {micEnabled ? <Mic size={22} /> : <MicOff size={22} />}
              </button>
              <button
                type="button"
                onClick={() => setCamEnabled((v) => !v)}
                className={`min-h-[44px] min-w-[44px] rounded-2xl flex items-center justify-center ${
                  camEnabled ? 'bg-white/15' : 'bg-white/5'
                }`}
                aria-label={camEnabled ? 'Camera on at join' : 'Camera off at join'}
                aria-pressed={camEnabled}
              >
                {camEnabled ? <Video size={22} /> : <VideoOff size={22} />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => void join()}
              className="w-full min-h-[48px] rounded-2xl bg-burgundy text-white font-bold text-base"
            >
              {mode === 'start' ? 'Start Family Huddle' : 'Join Family Huddle'}
            </button>
            <button
              type="button"
              onClick={() => void leave()}
              className="w-full min-h-[44px] text-sm text-white/60 font-medium"
            >
              Not now
            </button>
          </div>
        ) : null}

        {conn === 'connecting' || conn === 'reconnecting' ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-white/70">
            <Loader2 className="animate-spin" size={28} aria-hidden />
            <p className="text-sm font-medium">
              {conn === 'reconnecting'
                ? 'Reconnecting…'
                : mode === 'start'
                  ? 'Starting Family Huddle…'
                  : 'Joining Family Huddle…'}
            </p>
          </div>
        ) : null}

        {conn === 'connected' ? (
          <div className="space-y-3">
            {raisedNames.length > 0 ? (
              <div
                className="sticky top-0 z-20 rounded-2xl bg-gold/15 border border-gold/40 px-3 py-2.5 backdrop-blur-md"
                data-testid="hands-raised-strip"
              >
                <p className="text-xs font-black uppercase tracking-widest text-gold flex items-center gap-1.5">
                  <Hand size={14} aria-hidden /> Hands raised
                </p>
                <p className="text-xs font-bold text-white mt-1 leading-snug">{raisedNames.join(', ')}</p>
              </div>
            ) : null}
            <ul className="grid grid-cols-2 gap-2">
              {tiles.map((tile) => {
                const participant = participantFor(tile.identity);
                return (
                  <li
                    key={tile.identity}
                    className={`relative aspect-square rounded-xl overflow-hidden bg-white/10 border ${
                      tile.speaking ? 'border-gold' : 'border-white/10'
                    }`}
                  >
                    {tile.camOn && participant ? (
                      <ParticipantVideo
                        participant={participant}
                        isLocal={tile.isLocal}
                        camOn={tile.camOn}
                      />
                    ) : (
                      <div className="absolute inset-0 z-0 flex items-center justify-center">
                        <span className="w-10 h-10 rounded-full bg-burgundy/80 flex items-center justify-center text-base font-bold">
                          {(tile.name[0] || 'F').toUpperCase()}
                        </span>
                      </div>
                    )}
                    {tile.handRaised ? (
                      <div
                        className="absolute top-2 right-2 z-20 min-h-[36px] min-w-[36px] rounded-full bg-gold text-burgundy shadow-lg flex items-center justify-center"
                        aria-label="Hand raised"
                      >
                        <Hand size={18} aria-hidden />
                      </div>
                    ) : null}
                    <div className="absolute inset-x-0 bottom-0 z-10 p-1.5 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                      <p className="text-xs font-bold truncate">
                        {tile.name}
                        {tile.isLocal ? ' (you)' : ''}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-white/80">
                        {tile.micOn ? <Mic size={12} /> : <MicOff size={12} />}
                        {tile.handRaised ? <Hand size={12} className="text-gold" /> : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      {conn === 'connected' ? (
        <footer className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 border-t border-white/10 space-y-2">
          {error ? (
            <p className="text-xs text-red-300 text-center">{error}</p>
          ) : null}
          <HuddleMobileTabs
            active={activeTab}
            onChange={setActiveTab}
            handsCount={raisedEntries.length}
            chatUnread={chatUnread}
            attendanceCount={inCount || tiles.length}
          />
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void toggleMic()}
              className={`min-h-[44px] min-w-[44px] rounded-2xl flex items-center justify-center ${
                micEnabled ? 'bg-white/15' : 'bg-burgundy'
              }`}
              aria-label={micEnabled ? 'Mute' : 'Unmute'}
            >
              {micEnabled ? <Mic size={22} /> : <MicOff size={22} />}
            </button>
            <button
              type="button"
              onClick={() => void toggleCam()}
              className={`min-h-[44px] min-w-[44px] rounded-2xl flex items-center justify-center ${
                camEnabled ? 'bg-white/15' : 'bg-white/5'
              }`}
              aria-label={camEnabled ? 'Turn camera off' : 'Turn camera on'}
            >
              {camEnabled ? <Video size={22} /> : <VideoOff size={22} />}
            </button>
            <button
              type="button"
              onClick={() => void leave()}
              className="min-h-[44px] min-w-[44px] rounded-2xl bg-red-600 flex items-center justify-center"
              aria-label="Leave Family Huddle"
            >
              <PhoneOff size={22} />
            </button>
          </div>
          {canModerate && !isGuest ? (
            <button
              type="button"
              onClick={() => void endForEveryone()}
              disabled={ending}
              className="w-full min-h-[40px] text-xs font-bold text-red-300/90 disabled:opacity-50"
            >
              {ending ? 'Ending…' : 'End Family Huddle for everyone'}
            </button>
          ) : null}
        </footer>
      ) : null}

      <HuddleTabSheet tab={activeTab} onClose={() => setActiveTab(null)}>
        {activeTab === 'hands' ? (
          <HuddleHandsPanel
            raised={raisedEntries}
            handRaised={handRaised}
            onToggleHand={() => void toggleHand()}
          />
        ) : null}
        {activeTab === 'chat' ? (
          <HuddleChatPanel
            messages={chatMessages}
            onSend={sendChat}
            sending={chatSending}
          />
        ) : null}
        {activeTab === 'attendance' ? (
          <HuddlePeoplePanel
            variant="embedded"
            roster={roster}
            title="Attendance"
            footer={inviteFooter}
          />
        ) : null}
      </HuddleTabSheet>
    </div>
  );
};
