import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { Plus, Folder, Calendar, User, Search, Edit2, Trash2 } from 'lucide-react';

export default function Dashboard({ onSelectProject }) {
  const { getAuthHeaders, user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Edit Project State
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProjectToEdit, setSelectedProjectToEdit] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState('');

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/projects`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      } else {
        console.error('Failed to load projects');
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!name) return setError('Project name is required');
    setError('');
    setCreating(true);

    try {
      const res = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, description })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create project');
      }
      setProjects([data, ...projects]);
      setName('');
      setDescription('');
      setShowCreateModal(false);
      
      // Automatically navigate to the newly created project board!
      onSelectProject(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to permanently delete this project workspace? All lists, tasks, activity logs, and comments will be lost.')) return;
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setProjects(projects.filter(p => p.id !== projectId));
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to delete project');
      }
    } catch (err) {
      console.error('Error deleting project:', err);
      alert('Error deleting project');
    }
  };

  const handleEditProjectSubmit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return setEditError('Project name is required');
    setEditError('');
    setEditing(true);

    try {
      const res = await fetch(`${API_URL}/projects/${selectedProjectToEdit.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update project');
      }
      
      setProjects(projects.map(p => p.id === selectedProjectToEdit.id ? data : p));
      setShowEditModal(false);
      setSelectedProjectToEdit(null);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditing(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Dashboard Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '0.25rem' }}>
            Hello, <span style={{ color: 'var(--accent-primary)' }}>{user?.username}</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Welcome to your collaborative workspace</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={18} />
          New Project
        </button>
      </div>

      {/* Workspace Statistics Panel */}
      {!loading && projects.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2.5rem'
        }}>
          {/* Card 1: Total Workspaces */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)'
            }}>
              <Folder size={20} />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Boards</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{projects.length}</span>
            </div>
            <div style={{ position: 'absolute', bottom: '-20px', right: '-20px', width: '80px', height: '80px', background: 'var(--accent-primary-glow)', filter: 'blur(30px)', borderRadius: '50%', opacity: 0.15, pointerEvents: 'none' }} />
          </div>

          {/* Card 2: Owned Workspaces */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-secondary)'
            }}>
              <User size={20} />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Created By You</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{projects.filter(p => p.owner_id === user?.id).length}</span>
            </div>
            <div style={{ position: 'absolute', bottom: '-20px', right: '-20px', width: '80px', height: '80px', background: 'var(--accent-secondary-glow)', filter: 'blur(30px)', borderRadius: '50%', opacity: 0.15, pointerEvents: 'none' }} />
          </div>

          {/* Card 3: Shared Workspaces */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--priority-low)'
            }}>
              <Folder size={20} style={{ color: 'var(--priority-low)' }} />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Shared Workspaces</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{projects.filter(p => p.owner_id !== user?.id).length}</span>
            </div>
            <div style={{ position: 'absolute', bottom: '-20px', right: '-20px', width: '80px', height: '80px', background: 'rgba(16, 185, 129, 0.2)', filter: 'blur(30px)', borderRadius: '50%', opacity: 0.15, pointerEvents: 'none' }} />
          </div>
        </div>
      )}

      {/* Search Bar */}
      {!loading && projects.length > 0 && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.75rem' }}>
          <div style={{ position: 'relative', flexGrow: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="glass-input"
              placeholder="Search workspaces by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem', fontSize: '0.9rem', height: '42px' }}
            />
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
          Loading your workspaces...
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '5rem 2rem', borderStyle: 'dashed' }}>
          <Folder size={48} style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>No projects found</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
            Get started by creating a new collaborative project board to manage tasks with your team.
          </p>
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} />
            Create Your First Project
          </button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Folder size={36} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.25rem' }}>No workspaces match "{searchQuery}"</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Try searching for a different keyword or create a new project.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.5rem'
        }}>
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="glass-panel glass-panel-hover animate-fade-in"
              onClick={() => onSelectProject(project)}
              style={{
                padding: '1.5rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '200px',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Background Glow */}
              <div style={{
                position: 'absolute',
                top: '-50px',
                right: '-50px',
                width: '120px',
                height: '120px',
                background: project.owner_id === user?.id ? 'var(--accent-primary-glow)' : 'var(--accent-secondary-glow)',
                filter: 'blur(40px)',
                borderRadius: '50%',
                opacity: 0.4,
                pointerEvents: 'none'
              }} />

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--glass-border)'
                    }}>
                      <Folder size={18} style={{ color: 'var(--accent-primary)' }} />
                    </div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>{project.name}</h3>
                  </div>
                  
                  {project.owner_id === user?.id && (
                    <div style={{ display: 'flex', gap: '0.35rem', zIndex: 10 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProjectToEdit(project);
                          setEditName(project.name);
                          setEditDescription(project.description || '');
                          setShowEditModal(true);
                        }}
                        style={{
                          background: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '0.3rem',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          border: '1px solid transparent'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.color = '#fff';
                          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.color = 'var(--text-secondary)';
                          e.currentTarget.style.background = 'none';
                          e.currentTarget.style.borderColor = 'transparent';
                        }}
                        title="Edit Project"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project.id);
                        }}
                        style={{
                          background: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '0.3rem',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          border: '1px solid transparent'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.color = 'var(--priority-high)';
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                          e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.15)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.color = 'var(--text-secondary)';
                          e.currentTarget.style.background = 'none';
                          e.currentTarget.style.borderColor = 'transparent';
                        }}
                        title="Delete Project"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
                
                <p style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.9rem',
                  marginBottom: '1.5rem',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: '1.4'
                }}>
                  {project.description || 'No description provided.'}
                </p>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '1rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <User size={14} />
                  {project.owner_id === user?.id ? 'Owned by you' : `Owner: ${project.owner_name}`}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Calendar size={14} />
                  {new Date(project.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div
            className="glass-panel modal-content animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px' }}
          >
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Create Workspace</h2>
            
            <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 500 }}>
                  Project Name
                </label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Website Redesign"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  style={{ resize: 'none', fontFamily: 'inherit' }}
                />
              </div>

              {error && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fca5a5',
                  padding: '0.75rem',
                  fontSize: '0.85rem',
                  textAlign: 'center'
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => { setShowEditModal(false); setSelectedProjectToEdit(null); }}>
          <div
            className="glass-panel modal-content animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px' }}
          >
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Edit Workspace Details</h2>
            
            <form onSubmit={handleEditProjectSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 500 }}>
                  Project Name
                </label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Website Redesign"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
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
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  style={{ resize: 'none', fontFamily: 'inherit' }}
                />
              </div>

              {editError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fca5a5',
                  padding: '0.75rem',
                  fontSize: '0.85rem',
                  textAlign: 'center'
                }}>
                  {editError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => { setShowEditModal(false); setSelectedProjectToEdit(null); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={editing}>
                  {editing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
