module.exports = function (io) {
  io.on('connection', (socket) => {
    console.log('User connected via Socket.io:', socket.id);

    // Client joins a project board room
    socket.on('join_project', (projectId) => {
      const roomName = `project_${projectId}`;
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined room: ${roomName}`);
    });

    // Client leaves a project board room
    socket.on('leave_project', (projectId) => {
      const roomName = `project_${projectId}`;
      socket.leave(roomName);
      console.log(`Socket ${socket.id} left room: ${roomName}`);
    });

    // Client joins their personal user room (for notifications)
    socket.on('join_user', (userId) => {
      const roomName = `user_${userId}`;
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined user room: ${roomName}`);
    });

    // Client triggers a board change (card moved, column added, task added/deleted)
    socket.on('board_change', (projectId) => {
      const roomName = `project_${projectId}`;
      socket.to(roomName).emit('board_updated');
      console.log(`Board updated in project ${projectId}. Broadcasted event.`);
    });

    // Client posts a comment on a task
    socket.on('new_comment', ({ projectId, taskId, comment }) => {
      const roomName = `project_${projectId}`;
      socket.to(roomName).emit('comment_received', { taskId, comment });
      console.log(`New comment in project ${projectId} on task ${taskId}. Broadcasted.`);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected from Socket.io:', socket.id);
    });
  });
};
