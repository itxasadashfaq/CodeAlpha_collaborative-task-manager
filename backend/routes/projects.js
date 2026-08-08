const express = require('express');
const router = express.Router();
const { dbQuery } = require('../db');
const auth = require('../middleware/auth');

// @route   GET api/projects
// @desc    Get all projects for logged-in user (owned or joined as member)
router.get('/', auth, async (req, res) => {
  const userId = req.user.user.id;
  try {
    const projects = await dbQuery.all(`
      SELECT DISTINCT p.id, p.name, p.description, p.owner_id, p.created_at, u.username as owner_name 
      FROM projects p 
      JOIN users u ON p.owner_id = u.id 
      LEFT JOIN project_members pm ON p.id = pm.project_id 
      WHERE p.owner_id = ? OR pm.user_id = ?
      ORDER BY p.created_at DESC
    `, [userId, userId]);

    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error retrieving projects' });
  }
});

// @route   POST api/projects
// @desc    Create a new project (and default columns/lists)
router.post('/', auth, async (req, res) => {
  const { name, description } = req.body;
  const userId = req.user.user.id;

  if (!name) {
    return res.status(400).json({ message: 'Project name is required' });
  }

  try {
    // 1. Create project
    const projectResult = await dbQuery.run(
      'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)',
      [name, description || '', userId]
    );
    const projectId = projectResult.id;

    // 2. Add owner to project_members table
    await dbQuery.run(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
      [projectId, userId, 'owner']
    );

    // 3. Create default lists: To Do, In Progress, Done
    const defaultLists = ['To Do', 'In Progress', 'Done'];
    for (let i = 0; i < defaultLists.length; i++) {
      await dbQuery.run(
        'INSERT INTO lists (project_id, title, position) VALUES (?, ?, ?)',
        [projectId, defaultLists[i], i]
      );
    }

    // 4. Log creation in activity log
    await dbQuery.run(
      'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
      [projectId, userId, 'created the project workspace.']
    );

    // 5. Return new project details
    const newProject = await dbQuery.get(
      'SELECT p.*, u.username as owner_name FROM projects p JOIN users u ON p.owner_id = u.id WHERE p.id = ?',
      [projectId]
    );

    res.status(201).json(newProject);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating project' });
  }
});

// @route   GET api/projects/:id
// @desc    Get project details and members (with authorization check)
router.get('/:id', auth, async (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.user.id;

  try {
    // Verify membership
    const membership = await dbQuery.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );

    const project = await dbQuery.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!membership && project.owner_id !== userId) {
      return res.status(403).json({ message: 'Not authorized to view this project' });
    }

    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching project' });
  }
});

// @route   GET api/projects/:id/members
// @desc    Get project members list
router.get('/:id/members', auth, async (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.user.id;

  try {
    // Check authorization first
    const isMember = await dbQuery.get(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? UNION SELECT 1 FROM projects WHERE id = ? AND owner_id = ?',
      [projectId, userId, projectId, userId]
    );

    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const members = await dbQuery.all(`
      SELECT u.id, u.username, u.email, pm.role 
      FROM users u
      JOIN project_members pm ON u.id = pm.user_id
      WHERE pm.project_id = ?
    `, [projectId]);

    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching members' });
  }
});

// @route   POST api/projects/:id/members
// @desc    Add/Invite member to project
router.post('/:id/members', auth, async (req, res) => {
  const projectId = req.params.id;
  const { usernameOrEmail } = req.body;
  const invitingUserId = req.user.user.id;

  if (!usernameOrEmail) {
    return res.status(400).json({ message: 'Username or email is required' });
  }

  try {
    // Check if current user is owner or member of project
    const project = await dbQuery.get('SELECT owner_id, name FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const isMember = await dbQuery.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, invitingUserId]
    );

    if (project.owner_id !== invitingUserId && (!isMember || isMember.role !== 'owner')) {
      return res.status(403).json({ message: 'Only project owners can invite members' });
    }

    // Find the user to invite
    const targetUser = await dbQuery.get(
      'SELECT id, username, email FROM users WHERE username = ? OR email = ?',
      [usernameOrEmail, usernameOrEmail]
    );

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if target user is already in project
    const alreadyMember = await dbQuery.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, targetUser.id]
    );

    if (alreadyMember) {
      return res.status(400).json({ message: 'User is already a member of this project' });
    }

    // Add target user
    await dbQuery.run(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
      [projectId, targetUser.id, 'member']
    );

    // Create a notification for the invited user
    const notifResult = await dbQuery.run(
      'INSERT INTO notifications (user_id, content) VALUES (?, ?)',
      [targetUser.id, `You have been invited to the project "${project.name}" by ${req.user.user.username}`]
    );

    // Retrieve created notification details
    const notification = await dbQuery.get('SELECT * FROM notifications WHERE id = ?', [notifResult.id]);

    // Emit live WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${targetUser.id}`).emit('new_notification', notification);
    }

    // Insert into project activity log
    await dbQuery.run(
      'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
      [projectId, invitingUserId, `invited ${targetUser.username} to the project.`]
    );

    res.status(200).json({
      message: 'User successfully added to project',
      user: targetUser
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error inviting member' });
  }
});

// @route   PUT api/projects/:id
// @desc    Update project name and description (owner only)
router.put('/:id', auth, async (req, res) => {
  const projectId = req.params.id;
  const { name, description } = req.body;
  const userId = req.user.user.id;

  if (!name) {
    return res.status(400).json({ message: 'Project name is required' });
  }

  try {
    // Check if project exists and user is owner
    const project = await dbQuery.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.owner_id !== userId) {
      return res.status(403).json({ message: 'Only project owners can edit project settings' });
    }

    const updatedDesc = description !== undefined ? description : project.description;

    await dbQuery.run(
      'UPDATE projects SET name = ?, description = ? WHERE id = ?',
      [name, updatedDesc, projectId]
    );

    // Log Activity
    await dbQuery.run(
      'INSERT INTO activity_log (project_id, user_id, action_text) VALUES (?, ?, ?)',
      [projectId, userId, `updated project details (name: "${name}").`]
    );

    // Get owner details to match frontend project shape
    const updatedProject = await dbQuery.get(
      'SELECT p.*, u.username as owner_name FROM projects p JOIN users u ON p.owner_id = u.id WHERE p.id = ?',
      [projectId]
    );

    res.json(updatedProject);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating project' });
  }
});

// @route   DELETE api/projects/:id
// @desc    Delete project (owner only)
router.delete('/:id', auth, async (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.user.id;

  try {
    // Check if project exists and user is owner
    const project = await dbQuery.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.owner_id !== userId) {
      return res.status(403).json({ message: 'Only project owners can delete the project workspace' });
    }

    // Delete the project (cascading deletes will handle the rest)
    await dbQuery.run('DELETE FROM projects WHERE id = ?', [projectId]);

    res.json({ message: 'Project deleted successfully', projectId: parseInt(projectId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting project' });
  }
});

module.exports = router;
