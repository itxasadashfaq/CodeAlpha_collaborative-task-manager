import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import TaskCard from './TaskCard';
import TaskDetailModal from './TaskDetailModal';
import { ArrowLeft, Plus, Trash2, UserPlus, Users, Search, Activity, X, CheckSquare, Settings } from 'lucide-react';

export default function KanbanBoard({ project: initialProject, onBack, socket }) {
  const { getAuthHeaders, user } = useAuth();
  
  const [project, setProject] = useState(initialProject);
  useEffect(() => {
    setProject(initialProject);
    setEditProjectName(initialProject.name);
    setEditProjectDesc(initialProject.description || '');
  }, [initialProject]);

  // Project Settings Modal States
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [editProjectName, setEditProjectName] = useState(initialProject.name);
  const [editProjectDesc, setEditProjectDesc] = useState(initialProject.description || '');
  const [projectUpdating, setProjectUpdating] = useState(false);
  const [projectUpdateError, setProjectUpdateError] = useState('');

  const [boardData, setBoardData] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // List Creation State
  const [newListTitle, setNewListTitle] = useState('');
  const [showAddList, setShowAddList] = useState(false);
  
  // List Editing/Renaming State
  const [editingListId, setEditingListId] = useState(null);
  const [editingListTitle, setEditingListTitle] = useState('');
  
  // Task Creation State (tracked by List ID)
  const [newTaskTitles, setNewTaskTitles] = useState({});
  const [activeAddTaskId, setActiveAddTaskId] = useState(null);
  
  // Detail Modal State
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [viewMode, setViewMode] = useState('board'); // 'board' or 'analytics'
  
  // Member Invitation State
  const [inviteQuery, setInviteQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showInviteDropdown, setShowInviteDropdown] = useState(false);
  const [inviteMessage, setInviteMessage] = useState({ text: '', type: '' });

  // ----------------------------------------------------
  // FEATURE 4: BOARD SEARCH & FILTER STATES
  // ----------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterLabel, setFilterLabel] = useState('');

  // ----------------------------------------------------
  // FEATURE 5: ACTIVITY SIDEBAR STATES & FETCH
  // ----------------------------------------------------
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [activities, setActivities] = useState([]);

  const fetchBoardData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/boards/${project.id}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setBoardData(data);
      }
    } catch (err) {
      console.error('Error fetching board data:', err);
    }
  }, [project.id, getAuthHeaders]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/projects/${project.id}/members`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  }, [project.id, getAuthHeaders]);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/boards/${project.id}/activity`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setActivities(data);
      }
    } catch (err) {
      console.error('Error fetching activity log:', err);
    }
  }, [project.id, getAuthHeaders]);

  // Initial Load & Socket Room Subscription
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchBoardData(), fetchMembers()]);
      setLoading(false);
    };
    init();

    if (socket) {
      socket.emit('join_project', project.id);
      
      // Listen for remote updates
      socket.on('board_updated', () => {
        console.log('Board was updated remotely. Refreshing...');
        fetchBoardData();
        if (showActivityLog) {
          fetchActivities();
        }
      });
    }

    return () => {
      if (socket) {
        socket.emit('leave_project', project.id);
        socket.off('board_updated');
      }
    };
  }, [project.id, socket, fetchBoardData, fetchMembers, fetchActivities, showActivityLog]);

  // Fetch activities when activity log sidebar is opened
  useEffect(() => {
    if (showActivityLog) {
      fetchActivities();
    }
  }, [showActivityLog, fetchActivities]);

  // Search users to invite
  useEffect(() => {
    if (inviteQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const searchUsers = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/users?q=${inviteQuery}`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          const filtered = data.filter(u => !members.some(m => m.id === u.id));
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error('Error searching users:', err);
      }
    };
    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [inviteQuery, members, getAuthHeaders]);

  // List actions
  const handleAddList = async (e) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    try {
      const res = await fetch(`${API_URL}/boards/${project.id}/lists`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title: newListTitle })
      });
      if (res.ok) {
        const data = await res.json();
        setBoardData([...boardData, data]);
        setNewListTitle('');
        setShowAddList(false);
        if (socket) socket.emit('board_change', project.id);
        fetchActivities(); // Refresh activities locally
      }
    } catch (err) {
      console.error('Error adding list:', err);
    }
  };

  const handleDeleteList = async (listId) => {
    if (!window.confirm('Delete this column and all its tasks?')) return;
    try {
      const res = await fetch(`${API_URL}/boards/lists/${listId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setBoardData(boardData.filter(l => l.id !== listId));
        if (socket) socket.emit('board_change', project.id);
        fetchActivities();
      }
    } catch (err) {
      console.error('Error deleting list:', err);
    }
  };

  const handleRenameList = async (listId) => {
    if (!editingListTitle.trim()) {
      setEditingListId(null);
      return;
    }
    const currentList = boardData.find(l => l.id === listId);
    if (currentList.title === editingListTitle.trim()) {
      setEditingListId(null);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/boards/lists/${listId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title: editingListTitle.trim() })
      });
      if (res.ok) {
        setBoardData(boardData.map(l => l.id === listId ? { ...l, title: editingListTitle.trim() } : l));
        setEditingListId(null);
        if (socket) socket.emit('board_change', project.id);
        fetchActivities();
      }
    } catch (err) {
      console.error('Error renaming list:', err);
    }
  };

  // Task actions
  const handleAddTask = async (listId) => {
    const title = newTaskTitles[listId];
    if (!title || !title.trim()) return;

    try {
      const res = await fetch(`${API_URL}/boards/lists/${listId}/tasks`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title })
      });
      if (res.ok) {
        const data = await res.json();
        
        setBoardData(boardData.map(list => {
          if (list.id === listId) {
            return { ...list, tasks: [...list.tasks, data] };
          }
          return list;
        }));

        setNewTaskTitles({ ...newTaskTitles, [listId]: '' });
        setActiveAddTaskId(null);
        if (socket) socket.emit('board_change', project.id);
        fetchActivities();
      }
    } catch (err) {
      console.error('Error adding task:', err);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetListId, targetPosition = null) => {
    e.preventDefault();
    const taskIdStr = e.dataTransfer.getData('text/plain');
    if (!taskIdStr) return;
    const taskId = parseInt(taskIdStr);

    let draggedTask = null;
    let sourceListId = null;
    for (const list of boardData) {
      const task = list.tasks.find(t => t.id === taskId);
      if (task) {
        draggedTask = task;
        sourceListId = list.id;
        break;
      }
    }

    if (!draggedTask) return;

    const sourceList = boardData.find(l => l.id === sourceListId);
    const targetList = boardData.find(l => l.id === targetListId);

    if (sourceListId === targetListId) {
      // Same column reordering
      const tasksWithoutDragged = sourceList.tasks.filter(t => t.id !== taskId);
      const insertIndex = targetPosition !== null ? targetPosition : tasksWithoutDragged.length;
      const updatedTasks = [
        ...tasksWithoutDragged.slice(0, insertIndex),
        { ...draggedTask, position: insertIndex },
        ...tasksWithoutDragged.slice(insertIndex)
      ].map((t, idx) => ({ ...t, position: idx }));

      setBoardData(boardData.map(list => {
        if (list.id === sourceListId) return { ...list, tasks: updatedTasks };
        return list;
      }));

      try {
        await Promise.all(updatedTasks.map(t => {
          const orig = sourceList.tasks.find(o => o.id === t.id);
          if (orig && orig.position === t.position) return Promise.resolve();
          return fetch(`${API_URL}/boards/tasks/${t.id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ position: t.position })
          });
        }));
        if (socket) socket.emit('board_change', project.id);
        fetchActivities();
      } catch (err) {
        console.error('Error reordering tasks:', err);
        fetchBoardData();
      }
    } else {
      // Different column dragging
      const sourceTasks = sourceList.tasks.filter(t => t.id !== taskId).map((t, idx) => ({ ...t, position: idx }));
      const targetTasksWithoutDragged = targetList.tasks;
      const insertIndex = targetPosition !== null ? targetPosition : targetTasksWithoutDragged.length;
      
      const targetTasks = [
        ...targetTasksWithoutDragged.slice(0, insertIndex),
        { ...draggedTask, list_id: targetListId, position: insertIndex },
        ...targetTasksWithoutDragged.slice(insertIndex)
      ].map((t, idx) => ({ ...t, position: idx }));

      setBoardData(boardData.map(list => {
        if (list.id === sourceListId) return { ...list, tasks: sourceTasks };
        if (list.id === targetListId) return { ...list, tasks: targetTasks };
        return list;
      }));

      try {
        await fetch(`${API_URL}/boards/tasks/${taskId}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ list_id: targetListId, position: insertIndex })
        });
        
        const targetPromises = targetTasks.map(t => {
          if (t.id === taskId) return Promise.resolve();
          const orig = targetTasksWithoutDragged.find(o => o.id === t.id);
          if (orig && orig.position === t.position) return Promise.resolve();
          return fetch(`${API_URL}/boards/tasks/${t.id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ position: t.position })
          });
        });

        const sourcePromises = sourceTasks.map(t => {
          const orig = sourceList.tasks.find(o => o.id === t.id);
          if (orig && orig.position === t.position) return Promise.resolve();
          return fetch(`${API_URL}/boards/tasks/${t.id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ position: t.position })
          });
        });

        await Promise.all([...targetPromises, ...sourcePromises]);

        if (socket) socket.emit('board_change', project.id);
        fetchActivities();
      } catch (err) {
        console.error('Error dragging task between columns:', err);
        fetchBoardData();
      }
    }
  };

  // Invite member
  const handleInviteUser = async (targetUsername) => {
    setInviteMessage({ text: '', type: '' });
    try {
      const res = await fetch(`${API_URL}/projects/${project.id}/members`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ usernameOrEmail: targetUsername })
      });
      const data = await res.json();
      if (res.ok) {
        setInviteMessage({ text: 'Invited successfully!', type: 'success' });
        setMembers([...members, data.user]);
        setInviteQuery('');
        setSearchResults([]);
        setShowInviteDropdown(false);
        fetchActivities();
      } else {
        setInviteMessage({ text: data.message || 'Invitation failed', type: 'error' });
      }
    } catch (err) {
      console.error('Error inviting member:', err);
      setInviteMessage({ text: 'Error inviting user', type: 'error' });
    }
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    if (!editProjectName.trim()) {
      setProjectUpdateError('Project name is required');
      return;
    }
    setProjectUpdating(true);
    setProjectUpdateError('');

    try {
      const res = await fetch(`${API_URL}/projects/${project.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: editProjectName.trim(), description: editProjectDesc.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setProject(data);
        setShowProjectSettings(false);
        if (socket) socket.emit('board_change', project.id);
        fetchActivities();
      } else {
        setProjectUpdateError(data.message || 'Failed to update project');
      }
    } catch (err) {
      console.error('Error updating project:', err);
      setProjectUpdateError('Error updating project');
    } finally {
      setProjectUpdating(false);
    }
  };

  // Filtering function
  const getFilteredTasks = (tasks) => {
    return tasks.filter(task => {
      // Search matching title or description
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Assignee matching
      const matchesAssignee = filterAssignee === '' || task.assigned_to?.toString() === filterAssignee;
      
      // Priority matching
      const matchesPriority = filterPriority === '' || task.priority === filterPriority;
      
      // Label matching
      let matchesLabel = true;
      if (filterLabel !== '') {
        const activeLabels = task.labels ? task.labels.split(',') : [];
        matchesLabel = activeLabels.includes(filterLabel);
      }
      
      return matchesSearch && matchesAssignee && matchesPriority && matchesLabel;
    });
  };

  // Analytics computations
  const allTasks = boardData.flatMap(l => l.tasks || []);
  const totalBoardTasks = allTasks.length;
  const completedBoardTasks = boardData.length > 0 ? boardData[boardData.length - 1]?.tasks?.length || 0 : 0;
  const completionPercent = totalBoardTasks > 0 ? Math.round((completedBoardTasks / totalBoardTasks) * 100) : 0;

  const lowTasks = allTasks.filter(t => t.priority === 'low').length;
  const medTasks = allTasks.filter(t => t.priority === 'medium').length;
  const highTasks = allTasks.filter(t => t.priority === 'high').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: 'calc(100vh - 70px)', overflow: 'hidden' }}>
      
      {/* Board Core Area */}
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
        
        {/* Board Top Header */}
        <div style={{
          padding: '1rem 2rem',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(9, 13, 22, 0.25)',
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn-secondary" onClick={onBack} style={{ padding: '0.5rem', borderRadius: '50%' }}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{project.name}</h2>
                {project.owner_id === user?.id && (
                  <button
                    onClick={() => setShowProjectSettings(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px',
                      transition: 'color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-primary)'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    title="Edit project details"
                  >
                    <Settings size={15} />
                  </button>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{project.description || 'Collaborative Kanban board'}</p>
            </div>

            {/* View Switcher segment */}
            <div className="glass-panel" style={{ display: 'flex', padding: '2px', gap: '2px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', marginLeft: '1rem' }}>
              <button
                type="button"
                onClick={() => setViewMode('board')}
                style={{
                  background: viewMode === 'board' ? 'var(--accent-primary)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: viewMode === 'board' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.35rem 0.75rem',
                  transition: 'all 0.2s'
                }}
              >
                Board
              </button>
              <button
                type="button"
                onClick={() => setViewMode('analytics')}
                style={{
                  background: viewMode === 'analytics' ? 'var(--accent-primary)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: viewMode === 'analytics' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.35rem 0.75rem',
                  transition: 'all 0.2s'
                }}
              >
                Analytics
              </button>
            </div>
          </div>

          {/* Members & Invite Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            
            {/* Toggle Activity Log Button */}
            <button
              className="btn-secondary"
              onClick={() => setShowActivityLog(!showActivityLog)}
              style={{
                height: '32px',
                padding: '0 0.75rem',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                borderColor: showActivityLog ? 'var(--accent-primary)' : 'var(--glass-border)'
              }}
            >
              <Activity size={14} style={{ color: showActivityLog ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
              Activity Feed
            </button>

            {/* Members Avatars list */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Users size={16} style={{ color: 'var(--text-muted)', marginRight: '0.25rem' }} />
              <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
                {members.slice(0, 5).map((m, i) => (
                  <div
                    key={m.id}
                    className="avatar"
                    style={{
                      width: '28px',
                      height: '28px',
                      fontSize: '0.75rem',
                      border: '2px solid var(--bg-dark)',
                      marginLeft: i > 0 ? '-8px' : '0'
                    }}
                    title={m.username}
                  >
                    {m.username[0]}
                  </div>
                ))}
                {members.length > 5 && (
                  <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '0.7rem', border: '2px solid var(--bg-dark)', marginLeft: '-8px', background: '#374151' }}>
                    +{members.length - 5}
                  </div>
                )}
              </div>
            </div>

            {/* Invitation search input */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'relative', width: '180px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="glass-input"
                  placeholder="Invite member..."
                  value={inviteQuery}
                  onChange={(e) => {
                    setInviteQuery(e.target.value);
                    setShowInviteDropdown(true);
                  }}
                  style={{ paddingLeft: '2.2rem', paddingRight: '0.5rem', height: '32px', fontSize: '0.8rem' }}
                  onFocus={() => setShowInviteDropdown(true)}
                />
              </div>

              {/* Invite Dropdown results */}
              {showInviteDropdown && (inviteQuery.trim().length >= 2 || searchResults.length > 0) && (
                <div className="glass-panel animate-fade-in" style={{
                  position: 'absolute',
                  top: '38px',
                  right: 0,
                  width: '260px',
                  zIndex: 200,
                  padding: '0.5rem',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  boxShadow: 'var(--shadow-lg)',
                  background: 'rgba(15, 23, 42, 0.95)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Search Results</span>
                    <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }} onClick={() => setShowInviteDropdown(false)}>Close</button>
                  </div>
                  
                  {searchResults.length === 0 ? (
                    <p style={{ padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>No users found.</p>
                  ) : (
                    searchResults.map(u => (
                      <div
                        key={u.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.4rem 0.5rem',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        className="glass-card-hover"
                        onClick={() => handleInviteUser(u.username)}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{u.username}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{u.email}</span>
                        </div>
                        <UserPlus size={14} style={{ color: 'var(--accent-primary)' }} />
                      </div>
                    ))
                  )}
                </div>
              )}
              
              {inviteMessage.text && (
                <div style={{
                  position: 'absolute',
                  top: '-32px',
                  right: 0,
                  fontSize: '0.75rem',
                  color: inviteMessage.type === 'success' ? 'var(--priority-low)' : 'var(--priority-high)',
                  background: 'rgba(9, 13, 22, 0.9)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  border: `1px solid ${inviteMessage.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                }}>
                  {inviteMessage.text}
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-secondary)' }}>Loading board...</div>
        ) : viewMode === 'board' ? (
          <>
            {/* ---------------------------------------------------- */}
            {/* FEATURE 4: BOARD SEARCH & FILTER TOOLBAR */}
            {/* ---------------------------------------------------- */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              padding: '0.75rem 2rem',
              borderBottom: '1px solid var(--glass-border)',
              background: 'rgba(15, 23, 42, 0.15)',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              {/* Text search */}
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="glass-input"
                  placeholder="Search cards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '2.2rem', paddingRight: '0.5rem', height: '32px', fontSize: '0.8rem' }}
                />
              </div>

              {/* Assignee filter */}
              <select
                className="glass-input glass-select"
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                style={{ width: '150px', height: '32px', padding: '0 0.5rem', fontSize: '0.8rem' }}
              >
                <option value="">All Assignees</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.username}</option>
                ))}
              </select>

              {/* Priority filter */}
              <select
                className="glass-input glass-select"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                style={{ width: '130px', height: '32px', padding: '0 0.5rem', fontSize: '0.8rem' }}
              >
                <option value="">All Priorities</option>
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
              </select>

              {/* Label filter */}
              <select
                className="glass-input glass-select"
                value={filterLabel}
                onChange={(e) => setFilterLabel(e.target.value)}
                style={{ width: '130px', height: '32px', padding: '0 0.5rem', fontSize: '0.8rem' }}
              >
                <option value="">All Labels</option>
                <option value="Bug">Bug</option>
                <option value="Feature">Feature</option>
                <option value="Design">Design</option>
                <option value="Refactor">Refactor</option>
                <option value="Docs">Docs</option>
                <option value="Marketing">Marketing</option>
              </select>

              {/* Reset button */}
              {(searchQuery || filterAssignee || filterPriority || filterLabel) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterAssignee('');
                    setFilterPriority('');
                    setFilterLabel('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    textDecoration: 'underline'
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Columns & Lists Container */}
            <div className="board-container" style={{ flexGrow: 1, overflowY: 'hidden' }}>
              {boardData.map((list) => {
                const filteredTasks = getFilteredTasks(list.tasks);
                
                return (
                  <div
                    key={list.id}
                    className="glass-panel column-container"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, list.id, null)}
                  >
                    {/* Column Header */}
                    <div className="column-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>
                      {editingListId === list.id ? (
                        <input
                          type="text"
                          className="glass-input"
                          value={editingListTitle}
                          onChange={(e) => setEditingListTitle(e.target.value)}
                          onBlur={() => handleRenameList(list.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameList(list.id);
                            if (e.key === 'Escape') setEditingListId(null);
                          }}
                          autoFocus
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.4rem',
                            height: '28px',
                            background: 'rgba(255,255,255,0.05)',
                            flexGrow: 1
                          }}
                        />
                      ) : (
                        <span
                          className="column-title"
                          onDoubleClick={() => {
                            setEditingListId(list.id);
                            setEditingListTitle(list.title);
                          }}
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', flexGrow: 1 }}
                          title="Double-click to rename column"
                        >
                          {list.title}
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                            ({filteredTasks.length})
                          </span>
                        </span>
                      )}
                      <button
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 0.2s' }}
                        onClick={() => handleDeleteList(list.id)}
                        onMouseOver={(e) => e.target.style.color = 'var(--priority-high)'}
                        onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {/* Tasks List */}
                    <div className="task-list">
                      {filteredTasks.map((task, idx) => (
                        <div
                          key={task.id}
                          onDragOver={handleDragOver}
                          onDrop={(e) => {
                            e.stopPropagation();
                            handleDrop(e, list.id, idx);
                          }}
                        >
                          <TaskCard
                            task={task}
                            onClick={() => setActiveTaskId(task.id)}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Add Task Control */}
                    <div style={{ marginTop: '0.75rem' }}>
                      {activeAddTaskId === list.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <input
                            type="text"
                            className="glass-input"
                            placeholder="Enter task title..."
                            value={newTaskTitles[list.id] || ''}
                            onChange={(e) => setNewTaskTitles({ ...newTaskTitles, [list.id]: e.target.value })}
                            style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTask(list.id)}
                            autoFocus
                          />
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handleAddTask(list.id)}>
                              Add
                            </button>
                            <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setActiveAddTaskId(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          style={{
                            width: '100%',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px dashed var(--glass-border)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-secondary)',
                            padding: '0.5rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.25rem',
                            fontSize: '0.85rem'
                          }}
                          onClick={() => setActiveAddTaskId(list.id)}
                        >
                          <Plus size={14} /> Add Card
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add Column Button */}
              <div style={{ width: '320px', minWidth: '320px' }}>
                {showAddList ? (
                  <form onSubmit={handleAddList} className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <input
                      type="text"
                      className="glass-input"
                      placeholder="Column title..."
                      value={newListTitle}
                      onChange={(e) => setNewListTitle(e.target.value)}
                      style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                      required
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="submit" className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Add Column</button>
                      <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => setShowAddList(false)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button
                    className="glass-panel"
                    style={{
                      width: '100%',
                      background: 'var(--glass-bg)',
                      border: '1px dashed var(--glass-border)',
                      color: 'var(--text-primary)',
                      padding: '1rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      fontSize: '0.95rem'
                    }}
                    onClick={() => setShowAddList(true)}
                  >
                    <Plus size={18} /> Add Column
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Render Analytics View */
          <div style={{ padding: '2rem', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Top Cards row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
              
              {/* Card 1: Total Tasks */}
              <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                  <CheckSquare size={20} />
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Tasks</span>
                  <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff' }}>{totalBoardTasks}</span>
                </div>
              </div>

              {/* Card 2: Completed Tasks */}
              <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--priority-low)' }}>
                  <CheckSquare size={20} />
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Completed Tasks</span>
                  <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff' }}>{completedBoardTasks}</span>
                </div>
              </div>

              {/* Card 3: Completion Rate */}
              <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-secondary)' }}>
                  <Activity size={20} />
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Completion Rate</span>
                  <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff' }}>{completionPercent}%</span>
                </div>
              </div>

            </div>

            {/* Charts Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
              
              {/* Chart 1: Priority breakdown */}
              <div className="glass-panel" style={{ padding: '1.75rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem', color: '#fff' }}>Priority Distribution</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* High */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--priority-high)' }} /> High Priority</span>
                      <span style={{ fontWeight: 600 }}>{highTasks} tasks</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${totalBoardTasks > 0 ? (highTasks / totalBoardTasks) * 100 : 0}%`, background: 'var(--priority-high)', borderRadius: '4px' }} />
                    </div>
                  </div>

                  {/* Medium */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--priority-medium)' }} /> Medium Priority</span>
                      <span style={{ fontWeight: 600 }}>{medTasks} tasks</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${totalBoardTasks > 0 ? (medTasks / totalBoardTasks) * 100 : 0}%`, background: 'var(--priority-medium)', borderRadius: '4px' }} />
                    </div>
                  </div>

                  {/* Low */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--priority-low)' }} /> Low Priority</span>
                      <span style={{ fontWeight: 600 }}>{lowTasks} tasks</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${totalBoardTasks > 0 ? (lowTasks / totalBoardTasks) * 100 : 0}%`, background: 'var(--priority-low)', borderRadius: '4px' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart 2: Member Workload */}
              <div className="glass-panel" style={{ padding: '1.75rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem', color: '#fff' }}>Team Task Allocation</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {members.map(member => {
                    const count = allTasks.filter(t => t.assigned_to === member.id).length;
                    const percent = totalBoardTasks > 0 ? Math.round((count / totalBoardTasks) * 100) : 0;
                    return (
                      <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className="avatar" style={{ width: '26px', height: '26px', fontSize: '0.7rem', flexShrink: 0 }}>
                          {member.username[0]}
                        </div>
                        <div style={{ flexGrow: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                            <span>{member.username}</span>
                            <span style={{ fontWeight: 600 }}>{count} tasks ({percent}%)</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${percent}%`, background: 'var(--accent-primary)', borderRadius: '3px' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {allTasks.filter(t => !t.assigned_to).length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: '1px dashed var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        ?
                      </div>
                      <div style={{ flexGrow: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                          <span>Unassigned</span>
                          <span style={{ fontWeight: 600 }}>{allTasks.filter(t => !t.assigned_to).length} tasks ({totalBoardTasks > 0 ? Math.round((allTasks.filter(t => !t.assigned_to).length / totalBoardTasks) * 100) : 0}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${totalBoardTasks > 0 ? Math.round((allTasks.filter(t => !t.assigned_to).length / totalBoardTasks) * 100) : 0}%`, background: 'var(--text-muted)', borderRadius: '3px' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* FEATURE 5: ACTIVITY SIDEBAR DRAWER PANEL */}
      {/* ---------------------------------------------------- */}
      {showActivityLog && (
        <div
          className="glass-panel animate-fade-in"
          style={{
            width: '320px',
            minWidth: '320px',
            borderLeft: '1px solid var(--glass-border-hover)',
            borderRadius: 0,
            background: 'rgba(9, 13, 22, 0.7)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.3)'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '1.25rem',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={16} style={{ color: 'var(--accent-primary)' }} />
              Workspace Activity
            </span>
            <button
              onClick={() => setShowActivityLog(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Activities List */}
          <div style={{ padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
            {activities.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', marginTop: '2rem' }}>
                No workspace logs recorded yet.
              </p>
            ) : (
              activities.map((act) => (
                <div key={act.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                  <div className="avatar" style={{ width: '22px', height: '22px', fontSize: '0.65rem', flexShrink: 0 }}>
                    {act.username[0]}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <p style={{ fontSize: '0.8rem', color: '#e2e8f0', lineHeight: '1.4' }}>
                      <span style={{ fontWeight: 600, color: '#fff' }}>{act.username}</span> {act.action_text}
                    </p>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      {new Date(act.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {activeTaskId && (
        <TaskDetailModal
          taskId={activeTaskId}
          projectId={project.id}
          onClose={() => setActiveTaskId(null)}
          onTaskUpdated={() => {
            fetchBoardData();
            if (showActivityLog) fetchActivities();
          }}
          socket={socket}
          lists={boardData}
          members={members}
        />
      )}

      {/* Project Settings Modal */}
      {showProjectSettings && (
        <div className="modal-overlay" onClick={() => setShowProjectSettings(false)}>
          <div
            className="glass-panel modal-content animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px' }}
          >
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Edit Project Details</h2>
            
            <form onSubmit={handleUpdateProject} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 500 }}>
                  Project Name
                </label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Website Redesign"
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 500 }}>
                  Description (Optional)
                </label>
                <textarea
                  className="glass-input"
                  placeholder="Summarize the project's goal..."
                  value={editProjectDesc}
                  onChange={(e) => setEditProjectDesc(e.target.value)}
                  rows={3}
                  style={{ resize: 'none', fontFamily: 'inherit' }}
                />
              </div>

              {projectUpdateError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fca5a5',
                  padding: '0.75rem',
                  fontSize: '0.85rem',
                  textAlign: 'center'
                }}>
                  {projectUpdateError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowProjectSettings(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={projectUpdating}>
                  {projectUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
