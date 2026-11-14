// Public browser configuration only. NEVER put long-lived TURN secrets here.
// For restrictive networks, turnCredentialsUrl can point to your own HTTPS
// endpoint returning { iceServers: [...] } with short-lived TURN credentials.
export const NETWORK = {
  peerOptions: { host:'0.peerjs.com', port:443, secure:true, path:'/' },
  iceServers: [{ urls:'stun:stun.l.google.com:19302' },{ urls:'stun:stun1.l.google.com:19302' }],
  turnCredentialsUrl: '',
};
