const express = require('express');
const router = express.Router();
const { dbQuery } = require('../db');
const auth = require('../middleware/auth');

// Helper function to check if user has access to a project
async function checkProjectAccess(userId, projectId) {
  const access = await dbQuery.get(
    'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?',
    [projectId, userId]
  );
  return !!access;
}

// Helper function to check project access via list ID
async function checkListAccess(userId, listId) {
  const list = await dbQuery.get('SELECT project_id FROM lists WHERE id = ?', [listId]);
  if (!list) return false;
  return await checkProjectAccess(userId, list.project_id);
}

// Helper function to check project access via task ID
async function checkTaskAccess(userId, taskId) {
  const task = await dbQuery.get(
    'SELECT l.project_id FROM tasks t JOIN lists l ON t.list_id = l.id WHERE t.id = ?',
    [taskId]
  );
  if (!task) return false;
  return await checkProjectAccess(userId, task.project_id);
}

// ==========================================
// PROJECT ACTIVITY LOGS
// ==========================================

// @route   GET api/boards/:projectId/activity
// @desc    Get project activity log
router.get('/:projectId/activity', auth, async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.user.id;

  try {
    const hasAccess = await checkProjectAccess(userId, projectId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this project board' });
    }

    const logs = await dbQuery.all(`
      SELECT al.*, u.username
      FROM activity_log al
      JOIN users u ON al.user_id = u.id
      WHERE al.project_id = ?
      ORDER BY al.created_at DESC
      LIMIT 30
    `, [projectId]);

    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error retrieving activity logs' });
  }
});


// ==========================================
// LISTS & BOARD ROUTING
// ==========================================

// @route   GET api/boards/:projectId
// @desc    Get complete board state (lists and tasks nested with subtask counts)
router.get('/:projectId', auth, async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.user.id;

  try {
    const hasAccess = await checkProjectAccess(userId, projectId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this project board' });
    }

    // Get lists
    const lists = await dbQuery.all(
      'SELECT * FROM lists WHERE project_id = ? ORDER BY position ASC',
      [projectId]
    );

    // Get tasks for each list, along with assignee info and subtask completion counts
    const boardState = [];
    for (const list of lists) {
      const tasks = await dbQuery.all(`
        SELECT t.*, u.username as assignee_name, u.email as assignee_email,
               (SELECT COUNT(*) FROM subtasks WHERE task_id = t.id) as total_subtasks,
               (SELECT COUNT(*) FROM subtasks WHERE task_id = t.id AND is_completed = 1) as completed_subtasks
        FROM tasks t
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE t.list_id = ?
        ORDER BY t.position ASC
      `, [list.id]);

      boardState.push({
        ...list,
        tasks
      });
    }

    res.json(boardState);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error retrieving board state' });
  }
});

// @route   POST api/boards/:projectId/lists
// @desc    Create a new list/column
router.post('/:projectId/lists', auth, async (req, res) => {
  const { projectId } = req.params;
  const { title } = req.body;
  const userId = req.user.user.id;

  if (!title) {
    return res.status(400).json({ message: 'List title is required' });
  }

  try {
    const hasAccess = await checkProjectAccess(userId, projectId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Find current max position
    const maxPosRow = await dbQuery.get(
      'SELECT MAX(position) as maxPos FROM lists WHERE project_id = ?',
      [projectId]
    );
    const nextPos = (maxPosRow.maxPos !== null) ? maxPosRow.maxPos + 1 : 0;

    const result = await dbQuery.run(
      'INSERT INTO lists (project_id, title, position) VALUES (?, ?, ?)',
      [projectId, title, nextPos]
    );

    // Log Activity
    await dbQuery.run(
      'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
      [projectId, userId, `added column "${title}" to the board.`]
    );

    const newList = {
      id: result.id,
      project_id: parseInt(projectId),
      title,
      position: nextPos,
      tasks: []
    };

    res.status(201).json(newList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating list' });
  }
});

// @route   PUT api/boards/lists/:listId
// @desc    Update a list (rename or change position)
router.put('/lists/:listId', auth, async (req, res) => {
  const { listId } = req.params;
  const { title, position } = req.body;
  const userId = req.user.user.id;

  try {
    const hasAccess = await checkListAccess(userId, listId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const currentList = await dbQuery.get('SELECT * FROM lists WHERE id = ?', [listId]);
    if (!currentList) {
      return res.status(404).json({ message: 'List not found' });
    }

    const updatedTitle = title !== undefined ? title : currentList.title;
    const updatedPos = position !== undefined ? position : currentList.position;

    await dbQuery.run(
      'UPDATE lists SET title = ?, position = ? WHERE id = ?',
      [updatedTitle, updatedPos, listId]
    );

    // Log Activity if renamed
    if (title && title !== currentList.title) {
      await dbQuery.run(
        'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
        [currentList.project_id, userId, `renamed column "${currentList.title}" to "${updatedTitle}".`]
      );
    }

    res.json({ id: parseInt(listId), title: updatedTitle, position: updatedPos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating list' });
  }
});

// @route   DELETE api/boards/lists/:listId
// @desc    Delete list
router.delete('/lists/:listId', auth, async (req, res) => {
  const { listId } = req.params;
  const userId = req.user.user.id;

  try {
    const hasAccess = await checkListAccess(userId, listId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const currentList = await dbQuery.get('SELECT project_id, title FROM lists WHERE id = ?', [listId]);
    if (currentList) {
      await dbQuery.run('DELETE FROM lists WHERE id = ?', [listId]);
      
      // Log Activity
      await dbQuery.run(
        'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
        [currentList.project_id, userId, `deleted column "${currentList.title}".`]
      );
    }

    res.json({ message: 'List deleted successfully', listId: parseInt(listId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting list' });
  }
});


// ==========================================
// TASKS ROUTING
// ==========================================

// @route   POST api/boards/lists/:listId/tasks
// @desc    Create a task inside a list
router.post('/lists/:listId/tasks', auth, async (req, res) => {
  const { listId } = req.params;
  const { title } = req.body;
  const userId = req.user.user.id;

  if (!title) {
    return res.status(400).json({ message: 'Task title is required' });
  }

  try {
    const hasAccess = await checkListAccess(userId, listId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const list = await dbQuery.get('SELECT project_id, title FROM lists WHERE id = ?', [listId]);

    // Find current max position
    const maxPosRow = await dbQuery.get(
      'SELECT MAX(position) as maxPos FROM tasks WHERE list_id = ?',
      [listId]
    );
    const nextPos = (maxPosRow.maxPos !== null) ? maxPosRow.maxPos + 1 : 0;

    const result = await dbQuery.run(`
      INSERT INTO tasks (list_id, title, description, position, priority, due_date, assigned_to, cover_color, labels) 
      VALUES (?, ?, '', ?, 'medium', NULL, NULL, NULL, NULL)
    `, [listId, title, nextPos]);

    // Log Activity
    await dbQuery.run(
      'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
      [list.project_id, userId, `added task "${title}" to column "${list.title}".`]
    );

    const newTask = {
      id: result.id,
      list_id: parseInt(listId),
      title,
      description: '',
      position: nextPos,
      priority: 'medium',
      due_date: null,
      assigned_to: null,
      assignee_name: null,
      assignee_email: null,
      cover_color: null,
      labels: null,
      total_subtasks: 0,
      completed_subtasks: 0
    };

    res.status(201).json(newTask);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating task' });
  }
});

// @route   GET api/boards/tasks/:taskId
// @desc    Get task details including comments and subtasks
router.get('/tasks/:taskId', auth, async (req, res) => {
  const { taskId } = req.params;
  const userId = req.user.user.id;

  try {
    const hasAccess = await checkTaskAccess(userId, taskId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const task = await dbQuery.get(`
      SELECT t.*, u.username as assignee_name, u.email as assignee_email
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = ?
    `, [taskId]);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const comments = await dbQuery.all(`
      SELECT c.*, u.username as commentator_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.task_id = ?
      ORDER BY c.created_at ASC
    `, [taskId]);

    const subtasks = await dbQuery.all(
      'SELECT * FROM subtasks WHERE task_id = ?',
      [taskId]
    );

    res.json({
      task,
      comments,
      subtasks
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching task details' });
  }
});

// @route   PUT api/boards/tasks/:taskId
// @desc    Update task details (title, description, list_id, position, priority, due_date, assigned_to, cover_color, labels)
router.put('/tasks/:taskId', auth, async (req, res) => {
  const { taskId } = req.params;
  const userId = req.user.user.id;
  const { title, description, list_id, position, priority, due_date, assigned_to, cover_color, labels } = req.body;

  try {
    const hasAccess = await checkTaskAccess(userId, taskId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const currentTask = await dbQuery.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!currentTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const projectRow = await dbQuery.get('SELECT project_id FROM lists WHERE id = ?', [currentTask.list_id]);
    const projectId = projectRow.project_id;

    const updatedTitle = title !== undefined ? title : currentTask.title;
    const updatedDesc = description !== undefined ? description : currentTask.description;
    const updatedListId = list_id !== undefined ? list_id : currentTask.list_id;
    const updatedPos = position !== undefined ? position : currentTask.position;
    const updatedPriority = priority !== undefined ? priority : currentTask.priority;
    const updatedDueDate = due_date !== undefined ? due_date : currentTask.due_date;
    const updatedAssigned = assigned_to !== undefined ? assigned_to : currentTask.assigned_to;
    const updatedCover = cover_color !== undefined ? cover_color : currentTask.cover_color;
    const updatedLabels = labels !== undefined ? labels : currentTask.labels;

    // Check list access if moving lists
    if (list_id !== undefined && list_id !== currentTask.list_id) {
      const newListAccess = await checkListAccess(userId, list_id);
      if (!newListAccess) {
        return res.status(403).json({ message: 'Invalid target list authorization' });
      }
    }

    await dbQuery.run(`
      UPDATE tasks 
      SET title = ?, description = ?, list_id = ?, position = ?, priority = ?, due_date = ?, assigned_to = ?, cover_color = ?, labels = ? 
      WHERE id = ?
    `, [updatedTitle, updatedDesc, updatedListId, updatedPos, updatedPriority, updatedDueDate, updatedAssigned, updatedCover, updatedLabels, taskId]);

    // LOG ACTIONS TO ACTIVITY_LOG
    if (list_id !== undefined && list_id !== currentTask.list_id) {
      const oldList = await dbQuery.get('SELECT title FROM lists WHERE id = ?', [currentTask.list_id]);
      const newList = await dbQuery.get('SELECT title FROM lists WHERE id = ?', [list_id]);
      await dbQuery.run(
        'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
        [projectId, userId, `moved task "${currentTask.title}" from "${oldList.title}" to "${newList.title}".`]
      );
    } else if (priority !== undefined && priority !== currentTask.priority) {
      await dbQuery.run(
        'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
        [projectId, userId, `set priority of "${currentTask.title}" to "${priority}".`]
      );
    } else if (assigned_to !== undefined && assigned_to !== currentTask.assigned_to) {
      if (assigned_to) {
        const assignee = await dbQuery.get('SELECT username FROM users WHERE id = ?', [assigned_to]);
        await dbQuery.run(
          'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
          [projectId, userId, `assigned task "${currentTask.title}" to ${assignee.username}.`]
        );
        
        // Push notification to assigned user
        if (assigned_to !== userId) {
          const projectObj = await dbQuery.get('SELECT name FROM projects WHERE id = ?', [projectId]);
          const notifRes = await dbQuery.run(
            'INSERT INTO notifications (user_id, content) VALUES (?, ?)',
            [assigned_to, `You have been assigned to task "${currentTask.title}" in project "${projectObj.name}".`]
          );
          const notification = await dbQuery.get('SELECT * FROM notifications WHERE id = ?', [notifRes.id]);
          const io = req.app.get('io');
          if (io) {
            io.to(`user_${assigned_to}`).emit('new_notification', notification);
          }
        }
      } else {
        await dbQuery.run(
          'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
          [projectId, userId, `unassigned task "${currentTask.title}".`]
        );
      }
    } else if (title && title !== currentTask.title) {
      await dbQuery.run(
        'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
        [projectId, userId, `renamed task to "${updatedTitle}".`]
      );
    } else if (cover_color !== undefined && cover_color !== currentTask.cover_color) {
      await dbQuery.run(
        'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
        [projectId, userId, `updated cover color of task "${currentTask.title}".`]
      );
    } else if (labels !== undefined && labels !== currentTask.labels) {
      await dbQuery.run(
        'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
        [projectId, userId, `updated tags of task "${currentTask.title}".`]
      );
    }

    const updatedTask = await dbQuery.get(`
      SELECT t.*, u.username as assignee_name, u.email as assignee_email,
             (SELECT COUNT(*) FROM subtasks WHERE task_id = t.id) as total_subtasks,
             (SELECT COUNT(*) FROM subtasks WHERE task_id = t.id AND is_completed = 1) as completed_subtasks
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = ?
    `, [taskId]);

    res.json(updatedTask);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating task' });
  }
});

// @route   DELETE api/boards/tasks/:taskId
// @desc    Delete task
router.delete('/tasks/:taskId', auth, async (req, res) => {
  const { taskId } = req.params;
  const userId = req.user.user.id;

  try {
    const hasAccess = await checkTaskAccess(userId, taskId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const task = await dbQuery.get('SELECT l.project_id, t.title, t.list_id FROM tasks t JOIN lists l ON t.list_id = l.id WHERE t.id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await dbQuery.run('DELETE FROM tasks WHERE id = ?', [taskId]);

    // Log Activity
    await dbQuery.run(
      'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
      [task.project_id, userId, `deleted task "${task.title}".`]
    );

    res.json({ message: 'Task deleted successfully', taskId: parseInt(taskId), listId: task.list_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting task' });
  }
});


// ==========================================
// SUBTASKS ROUTING
// ==========================================

// @route   POST api/boards/tasks/:taskId/subtasks
// @desc    Add a subtask to a task
router.post('/tasks/:taskId/subtasks', auth, async (req, res) => {
  const { taskId } = req.params;
  const { title } = req.body;
  const userId = req.user.user.id;

  if (!title) {
    return res.status(400).json({ message: 'Subtask title is required' });
  }

  try {
    const hasAccess = await checkTaskAccess(userId, taskId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await dbQuery.run(
      'INSERT INTO subtasks (task_id, title, is_completed) VALUES (?, ?, 0)',
      [taskId, title]
    );

    // Log Activity
    const taskInfo = await dbQuery.get('SELECT l.project_id, t.title FROM tasks t JOIN lists l ON t.list_id = l.id WHERE t.id = ?', [taskId]);
    await dbQuery.run(
      'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
      [taskInfo.project_id, userId, `added subtask "${title}" to task "${taskInfo.title}".`]
    );

    const newSubtask = {
      id: result.id,
      task_id: parseInt(taskId),
      title,
      is_completed: 0
    };

    res.status(201).json(newSubtask);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating subtask' });
  }
});

// @route   PUT api/boards/subtasks/:subtaskId
// @desc    Update subtask (toggle completion or rename)
router.put('/subtasks/:subtaskId', auth, async (req, res) => {
  const { subtaskId } = req.params;
  const { title, is_completed } = req.body;
  const userId = req.user.user.id;

  try {
    const subtask = await dbQuery.get('SELECT * FROM subtasks WHERE id = ?', [subtaskId]);
    if (!subtask) {
      return res.status(404).json({ message: 'Subtask not found' });
    }

    const hasAccess = await checkTaskAccess(userId, subtask.task_id);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updatedTitle = title !== undefined ? title : subtask.title;
    const updatedCompleted = is_completed !== undefined ? is_completed : subtask.is_completed;

    await dbQuery.run(
      'UPDATE subtasks SET title = ?, is_completed = ? WHERE id = ?',
      [updatedTitle, updatedCompleted, subtaskId]
    );

    // Log Activity
    const taskInfo = await dbQuery.get('SELECT l.project_id, t.title FROM tasks t JOIN lists l ON t.list_id = l.id WHERE t.id = ?', [subtask.task_id]);
    const actionWord = updatedCompleted ? 'completed' : 'uncompleted';
    await dbQuery.run(
      'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
      [taskInfo.project_id, userId, `${actionWord} subtask "${updatedTitle}" in task "${taskInfo.title}".`]
    );

    res.json({
      id: parseInt(subtaskId),
      task_id: subtask.task_id,
      title: updatedTitle,
      is_completed: updatedCompleted
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating subtask' });
  }
});

// @route   DELETE api/boards/subtasks/:subtaskId
// @desc    Delete a subtask
router.delete('/subtasks/:subtaskId', auth, async (req, res) => {
  const { subtaskId } = req.params;
  const userId = req.user.user.id;

  try {
    const subtask = await dbQuery.get('SELECT * FROM subtasks WHERE id = ?', [subtaskId]);
    if (!subtask) {
      return res.status(404).json({ message: 'Subtask not found' });
    }

    const hasAccess = await checkTaskAccess(userId, subtask.task_id);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const taskInfo = await dbQuery.get('SELECT l.project_id, t.title FROM tasks t JOIN lists l ON t.list_id = l.id WHERE t.id = ?', [subtask.task_id]);

    await dbQuery.run('DELETE FROM subtasks WHERE id = ?', [subtaskId]);

    // Log Activity
    await dbQuery.run(
      'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
      [taskInfo.project_id, userId, `deleted subtask "${subtask.title}" in task "${taskInfo.title}".`]
    );

    res.json({ message: 'Subtask deleted successfully', subtaskId: parseInt(subtaskId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting subtask' });
  }
});


// ==========================================
// COMMENTS ROUTING
// ==========================================

// @route   POST api/boards/tasks/:taskId/comments
// @desc    Add comment to a task
router.post('/tasks/:taskId/comments', auth, async (req, res) => {
  const { taskId } = req.params;
  const { content } = req.body;
  const userId = req.user.user.id;

  if (!content) {
    return res.status(400).json({ message: 'Comment content is required' });
  }

  try {
    const hasAccess = await checkTaskAccess(userId, taskId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await dbQuery.run(
      'INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)',
      [taskId, userId, content]
    );

    const comment = await dbQuery.get(`
      SELECT c.*, u.username as commentator_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [result.id]);

    // Log Activity
    const taskInfo = await dbQuery.get('SELECT l.project_id, t.title FROM tasks t JOIN lists l ON t.list_id = l.id WHERE t.id = ?', [taskId]);
    await dbQuery.run(
      'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
      [taskInfo.project_id, userId, `commented on task "${taskInfo.title}".`]
    );

    res.status(201).json(comment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error posting comment' });
  }
});

module.exports = router;
