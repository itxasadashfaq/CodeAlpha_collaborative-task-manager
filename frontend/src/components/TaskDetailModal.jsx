import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { X, Calendar, User, MessageSquare, FileText, Trash2, Send, CheckSquare, Tag, Image, Check, Plus } from 'lucide-react';

// Preset cover color maps
const COVER_PRESETS = {
  sunset: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
  aurora: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
  ocean: 'linear-gradient(135deg, #0284c7 0%, #6366f1 100%)',
  cosmic: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
  neon: 'linear-gradient(135deg, #d946ef 0%, #06b6d4 100%)'
};

const LABEL_PRESETS = {
  Bug: '#ef4444',      // Red
  Feature: '#3b82f6',  // Blue
  Design: '#ec4899',   // Pink
  Refactor: '#f59e0b', // Orange/Amber
  Docs: '#10b981',     // Green
  Marketing: '#8b5cf6' // Purple
};

export default function TaskDetailModal({ taskId, projectId, onClose, onTaskUpdated, socket, lists, members }) {
  const { getAuthHeaders, user } = useAuth();
  
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Input fields
  const [newComment, setNewComment] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  
  // Toggle states
  const [commenting, setCommenting] = useState(false);
  const [subtasking, setSubtasking] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);

  // Form bindings
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [listId, setListId] = useState('');
  const [priority, setPriority] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  
  const commentsEndRef = useRef(null);

  const fetchTaskDetails = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/boards/tasks/${taskId}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setTask(data.task);
        setComments(data.comments);
        setSubtasks(data.subtasks || []);
        
        // Initialize form fields
        setTitle(data.task.title);
        setDescription(data.task.description || '');
        setListId(data.task.list_id.toString());
        setPriority(data.task.priority);
        setDueDate(data.task.due_date || '');
        setAssignedTo(data.task.assigned_to ? data.task.assigned_to.toString() : '');
      }
    } catch (err) {
      console.error('Error fetching task details:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId, getAuthHeaders]);

  useEffect(() => {
    fetchTaskDetails();
  }, [fetchTaskDetails]);

  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  // Socket listener for real-time comments
  useEffect(() => {
    if (!socket) return;

    const handleCommentReceived = ({ taskId: incomingTaskId, comment }) => {
      if (incomingTaskId.toString() === taskId.toString()) {
        setComments((prev) => {
          if (prev.some((c) => c.id === comment.id)) return prev;
          return [...prev, comment];
        });
      }
    };

    socket.on('comment_received', handleCommentReceived);

    return () => {
      socket.off('comment_received', handleCommentReceived);
    };
  }, [socket, taskId]);

  const handleUpdateField = async (updatedFields) => {
    setTask((prev) => ({ ...prev, ...updatedFields }));
    
    try {
      const res = await fetch(`${API_URL}/boards/tasks/${taskId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedFields)
      });
      if (res.ok) {
        const data = await res.json();
        setTask(data);
        onTaskUpdated();
        if (socket) {
          socket.emit('board_change', projectId);
        }
      }
    } catch (err) {
      console.error('Error updating task field:', err);
    }
  };

  // Subtask management actions
  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    setSubtasking(true);

    try {
      const res = await fetch(`${API_URL}/boards/tasks/${taskId}/subtasks`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title: newSubtaskTitle })
      });
      if (res.ok) {
        const sub = await res.json();
        setSubtasks([...subtasks, sub]);
        setNewSubtaskTitle('');
        onTaskUpdated();
        if (socket) socket.emit('board_change', projectId);
      }
    } catch (err) {
      console.error('Error creating subtask:', err);
    } finally {
      setSubtasking(false);
    }
  };

  const handleToggleSubtask = async (subtaskId, completedState) => {
    const updatedSubtasks = subtasks.map(s => {
      if (s.id === subtaskId) return { ...s, is_completed: completedState ? 1 : 0 };
      return s;
    });
    setSubtasks(updatedSubtasks);

    try {
      const res = await fetch(`${API_URL}/boards/subtasks/${subtaskId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_completed: completedState ? 1 : 0 })
      });
      if (res.ok) {
        onTaskUpdated();
        if (socket) socket.emit('board_change', projectId);
      }
    } catch (err) {
      console.error('Error toggling subtask:', err);
      fetchTaskDetails(); // Rollback
    }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    setSubtasks(subtasks.filter(s => s.id !== subtaskId));
    try {
      const res = await fetch(`${API_URL}/boards/subtasks/${subtaskId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        onTaskUpdated();
        if (socket) socket.emit('board_change', projectId);
      }
    } catch (err) {
      console.error('Error deleting subtask:', err);
      fetchTaskDetails();
    }
  };

  // Label management
  const handleToggleLabel = (labelText) => {
    const activeLabels = task.labels ? task.labels.split(',').filter(Boolean) : [];
    let newLabels;
    if (activeLabels.includes(labelText)) {
      newLabels = activeLabels.filter(l => l !== labelText);
    } else {
      newLabels = [...activeLabels, labelText];
    }
    const labelString = newLabels.join(',');
    handleUpdateField({ labels: labelString || null });
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setCommenting(true);

    try {
      const res = await fetch(`${API_URL}/boards/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content: newComment })
      });
      if (res.ok) {
        const commentData = await res.json();
        setComments((prev) => [...prev, commentData]);
        setNewComment('');
        if (socket) {
          socket.emit('new_comment', { projectId, taskId, comment: commentData });
        }
      }
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setCommenting(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await fetch(`${API_URL}/boards/tasks/${taskId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        onTaskUpdated();
        if (socket) socket.emit('board_change', projectId);
        onClose();
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="glass-panel modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
          Loading task details...
        </div>
      </div>
    );
  }

  // Subtask calculations
  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter(s => s.is_completed === 1).length;
  const subtaskPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  const currentCoverStyle = task.cover_color && COVER_PRESETS[task.cover_color]
    ? COVER_PRESETS[task.cover_color]
    : 'transparent';

  const activeLabelsList = task.labels ? task.labels.split(',').filter(Boolean) : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="glass-panel modal-content animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          padding: 0,
          overflow: 'hidden'
        }}
      >
        {/* ==================================================== */}
        {/* FEATURE 6: MODAL COVER GRADIENT BANNER */}
        {/* ==================================================== */}
        <div style={{
          height: task.cover_color ? '130px' : '30px',
          background: currentCoverStyle,
          width: '100%',
          position: 'relative',
          transition: 'height 0.3s ease, background 0.3s ease'
        }}>
          <button className="modal-close" onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: '10px', right: '15px', color: '#fff', background: 'rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '2rem' }}>
          
          {/* Active labels preview */}
          {activeLabelsList.length > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {activeLabelsList.map(l => (
                <span
                  key={l}
                  className="badge"
                  style={{
                    background: `${LABEL_PRESETS[l] || '#4B5563'}33`,
                    color: LABEL_PRESETS[l] || '#fff',
                    border: `1px solid ${LABEL_PRESETS[l]}44`,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px'
                  }}
                >
                  {l}
                </span>
              ))}
            </div>
          )}

          {/* Task Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== task.title && handleUpdateField({ title })}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid transparent',
              color: 'var(--text-primary)',
              fontSize: '1.5rem',
              fontWeight: 700,
              width: 'calc(100% - 30px)',
              marginBottom: '1.5rem',
              outline: 'none',
              padding: '0.2rem 0'
            }}
            onFocus={(e) => e.target.style.borderBottomColor = 'var(--accent-primary)'}
            placeholder="Task title..."
          />

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 240px',
            gap: '2rem',
            alignItems: 'start'
          }}>
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              
              {/* Description */}
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={16} /> Description
                </h4>
                <textarea
                  className="glass-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => description !== task.description && handleUpdateField({ description })}
                  placeholder="Add details for this task..."
                  rows={3}
                  style={{ resize: 'none', fontFamily: 'inherit', padding: '0.75rem', fontSize: '0.9rem' }}
                />
              </div>

              {/* ---------------------------------------------------- */}
              {/* FEATURE 1: SUBTASK CHECKLISTS & PROGRESS BAR */}
              {/* ---------------------------------------------------- */}
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckSquare size={16} /> Subtasks Checklist
                </h4>

                {/* Progress bar container */}
                {totalSubtasks > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', width: '32px', textAlign: 'right' }}>
                      {subtaskPercent}%
                    </span>
                    <div style={{
                      flexGrow: 1,
                      height: '8px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${subtaskPercent}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                        borderRadius: '4px',
                        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                      }} />
                    </div>
                  </div>
                )}

                {/* Subtasks List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {subtasks.map(sub => (
                    <div
                      key={sub.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.4rem 0.5rem',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid rgba(255,255,255,0.02)'
                      }}
                      className="glass-card-hover"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexGrow: 1 }}>
                        <input
                          type="checkbox"
                          checked={sub.is_completed === 1}
                          onChange={(e) => handleToggleSubtask(sub.id, e.target.checked)}
                          style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                        />
                        <span style={{
                          fontSize: '0.85rem',
                          color: sub.is_completed === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: sub.is_completed === 1 ? 'line-through' : 'none',
                          wordBreak: 'break-all'
                        }}>
                          {sub.title}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteSubtask(sub.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                        onMouseOver={(e) => e.currentTarget.style.color = 'var(--priority-high)'}
                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Subtask Form */}
                <form onSubmit={handleAddSubtask} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="glass-input"
                    placeholder="Add checklist item..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    style={{ height: '34px', fontSize: '0.85rem', padding: '0.5rem' }}
                  />
                  <button type="submit" className="btn-secondary" disabled={subtasking} style={{ height: '34px', padding: '0 0.75rem', fontSize: '0.8rem' }}>
                    Add
                  </button>
                </form>
              </div>

              {/* Comments Thread */}
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MessageSquare size={16} /> Comments
                </h4>

                <div className="glass-panel" style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  padding: '1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  background: 'rgba(9, 13, 22, 0.4)'
                }}>
                  {comments.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
                      No comments yet.
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                        <div className="avatar" style={{ width: '24px', height: '24px', fontSize: '0.7rem' }}>
                          {c.commentator_name[0]}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginBottom: '0.15rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.commentator_name}</span>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {new Date(c.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p style={{
                            background: c.user_id === user?.id ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255,255,255,0.04)',
                            borderRadius: '8px',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.85rem',
                            color: '#e2e8f0',
                            wordBreak: 'break-word',
                            alignSelf: 'flex-start'
                          }}>
                            {c.content}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={commentsEndRef} />
                </div>

                <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="glass-input"
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    style={{ height: '36px', fontSize: '0.85rem' }}
                  />
                  <button type="submit" className="btn-primary" disabled={commenting} style={{ height: '36px', padding: '0 1rem' }}>
                    <Send size={14} />
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column */}
            <div className="glass-panel" style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              background: 'rgba(30, 41, 59, 0.15)'
            }}>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                Properties
              </h5>

              {/* Status */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 600 }}>Status</label>
                <select
                  className="glass-input glass-select"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                  value={listId}
                  onChange={(e) => {
                    setListId(e.target.value);
                    handleUpdateField({ list_id: parseInt(e.target.value) });
                  }}
                >
                  {lists.map(l => (
                    <option key={l.id} value={l.id}>{l.title}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 600 }}>Priority</label>
                <select
                  className="glass-input glass-select"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                  value={priority}
                  onChange={(e) => {
                    setPriority(e.target.value);
                    handleUpdateField({ priority: e.target.value });
                  }}
                >
                  <option value="low">🟢 Low</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="high">🔴 High</option>
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label style={{ display: 'flex', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 600, alignItems: 'center', gap: '0.25rem' }}>
                  <Calendar size={12} /> Due Date
                </label>
                <input
                  type="date"
                  className="glass-input"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    handleUpdateField({ due_date: e.target.value || null });
                  }}
                />
              </div>

              {/* Assignee */}
              <div>
                <label style={{ display: 'flex', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 600, alignItems: 'center', gap: '0.25rem' }}>
                  <User size={12} /> Assignee
                </label>
                <select
                  className="glass-input glass-select"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                  value={assignedTo}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAssignedTo(val);
                    handleUpdateField({ assigned_to: val ? parseInt(val) : null });
                  }}
                >
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.username}</option>
                  ))}
                </select>
              </div>

              {/* ---------------------------------------------------- */}
              {/* FEATURE 2: TAG/LABELS SELECTION */}
              {/* ---------------------------------------------------- */}
              <div>
                <label style={{ display: 'flex', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 600, alignItems: 'center', gap: '0.25rem' }}>
                  <Tag size={12} /> Tags / Labels
                </label>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowLabelDropdown(!showLabelDropdown)}
                    style={{
                      width: '100%',
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.8rem',
                      justifyContent: 'space-between',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <span>Manage Tags</span>
                    <Plus size={12} />
                  </button>

                  {showLabelDropdown && (
                    <div className="glass-panel" style={{
                      position: 'absolute',
                      top: '32px',
                      left: 0,
                      width: '100%',
                      zIndex: 10,
                      padding: '0.5rem',
                      background: 'rgba(15,23,42,0.98)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      boxShadow: 'var(--shadow-md)'
                    }}>
                      {Object.keys(LABEL_PRESETS).map(lbl => {
                        const isChecked = activeLabelsList.includes(lbl);
                        
                        return (
                          <div
                            key={lbl}
                            onClick={() => handleToggleLabel(lbl)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.3rem 0.5rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              background: isChecked ? 'rgba(255,255,255,0.05)' : 'transparent',
                              fontSize: '0.8rem'
                            }}
                            className="glass-card-hover"
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: LABEL_PRESETS[lbl] }} />
                              {lbl}
                            </span>
                            {isChecked && <Check size={12} style={{ color: 'var(--accent-primary)' }} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* FEATURE 6: COVER GRADIENTS PRESENTS PICKER */}
              {/* ---------------------------------------------------- */}
              <div>
                <label style={{ display: 'flex', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600, alignItems: 'center', gap: '0.25rem' }}>
                  <Image size={12} /> Cover Styling
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {/* None */}
                   <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateField({ cover_color: null });
                    }}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.05)',
                      border: !task.cover_color ? '2px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.55rem',
                      color: 'var(--text-muted)'
                    }}
                    title="No cover banner"
                  >
                    /
                  </button>

                  {/* Preset colors */}
                  {Object.keys(COVER_PRESETS).map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateField({ cover_color: preset });
                      }}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: COVER_PRESETS[preset],
                        border: task.cover_color === preset ? '2px solid #fff' : '1px solid transparent',
                        boxShadow: task.cover_color === preset ? '0 0 10px rgba(255,255,255,0.4)' : 'none',
                        cursor: 'pointer'
                      }}
                      title={`${preset} gradient`}
                    />
                  ))}
                </div>
              </div>

              {/* Delete Task action */}
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={handleDeleteTask}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontSize: '0.85rem',
                    padding: '0.6rem'
                  }}
                >
                  <Trash2 size={14} /> Delete Task
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
