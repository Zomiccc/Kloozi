// Shared handle on the Socket.io server so services outside the request
// cycle (webhooks, schedulers) can push live updates to connected clients.
let io = null;

function setIO(instance) {
  io = instance;
}

function emitToUser(userId, event, payload) {
  if (io && userId) io.to(`user:${userId}`).emit(event, payload);
}

function emitToWorkspace(workspaceId, event, payload) {
  if (io && workspaceId) io.to(`workspace:${workspaceId}`).emit(event, payload);
}

module.exports = { setIO, emitToUser, emitToWorkspace };
