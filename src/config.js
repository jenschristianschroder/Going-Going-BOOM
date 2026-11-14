// Public browser configuration only. NEVER put long-lived TURN secrets here.
// For restrictive networks, turnCredentialsUrl can point to your own HTTPS
// endpoint returning { iceServers: [...] } with short-lived TURN credentials.
export const NETWORK = {
  peerOptions: { host:'0.peerjs.com', port:443, secure:true, path:'/' },
  // null preserves the pinned PeerJS client's default STUN + public TURN relay.
  // An explicit array replaces those defaults with your own ICE servers.
  iceServers: null,
  turnCredentialsUrl: '',
};
