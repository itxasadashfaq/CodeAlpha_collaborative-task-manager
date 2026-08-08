import React from 'react';
import { Calendar, CheckSquare } from 'lucide-react';

const COVER_PRESETS = {
  sunset: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
  aurora: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
  ocean: 'linear-gradient(135deg, #0284c7 0%, #6366f1 100%)',
  cosmic: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
  neon: 'linear-gradient(135deg, #d946ef 0%, #06b6d4 100%)'
};

const LABEL_PRESETS = {
  Bug: '#ef4444',
  Feature: '#3b82f6',
  Design: '#ec4899',
  Refactor: '#f59e0b',
  Docs: '#10b981',
  Marketing: '#8b5cf6'
};

export default function TaskCard({ task, onClick }) {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', task.id.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const getPriorityClass = (p) => {
    switch (p) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return '';
    }
  };

  const getPriorityBadge = (p) => {
    switch (p) {
      case 'high': return <span className="badge badge-high">High</span>;
      case 'medium': return <span className="badge badge-medium">Medium</span>;
      case 'low': return <span className="badge badge-low">Low</span>;
      default: return null;
    }
  };

  const formatDueDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const activeLabels = task.labels ? task.labels.split(',').filter(Boolean) : [];
  const hasCover = task.cover_color && COVER_PRESETS[task.cover_color];

  return (
    <div
      className={`glass-card glass-card-hover task-card-inner ${getPriorityClass(task.priority)} animate-fade-in`}
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        userSelect: 'none',
        padding: 0,
        overflow: 'hidden'
      }}
    >
      {/* ---------------------------------------------------- */}
      {/* FEATURE 6: MINI COVER GRADIENT BANNER */}
      {/* ---------------------------------------------------- */}
      {hasCover && (
        <div style={{
          height: '36px',
          background: COVER_PRESETS[task.cover_color],
          width: '100%'
        }} />
      )}

      {/* Card Content Pad */}
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        
        {/* ---------------------------------------------------- */}
        {/* FEATURE 2: TAG BADGES ON PREVIEW CARD */}
        {/* ---------------------------------------------------- */}
        {activeLabels.length > 0 && (
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.1rem' }}>
            {activeLabels.map(l => (
              <span
                key={l}
                style={{
                  display: 'inline-block',
                  width: '32px',
                  height: '6px',
                  borderRadius: '3px',
                  background: LABEL_PRESETS[l] || '#4B5563'
                }}
                title={l}
              />
            ))}
          </div>
        )}

        {/* Title */}
        <h5 className="task-card-title" style={{ margin: 0 }}>{task.title}</h5>
        
        {/* Description preview */}
        {task.description && (
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            lineHeight: '1.4',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            margin: 0
          }}>
            {task.description}
          </p>
        )}

        {/* Bottom line: badges, due date, subtasks, assignee */}
        <div className="task-card-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {getPriorityBadge(task.priority)}
            
            {task.due_date && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <Calendar size={11} />
                {formatDueDate(task.due_date)}
              </span>
            )}

            {/* ---------------------------------------------------- */}
            {/* FEATURE 1: SUBTASK CHECKLIST PROGRESS BAR */}
            {/* ---------------------------------------------------- */}
            {task.total_subtasks > 0 && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.75rem',
                color: task.completed_subtasks === task.total_subtasks ? 'var(--priority-low)' : 'var(--text-secondary)'
              }} title={`Subtasks: ${task.completed_subtasks}/${task.total_subtasks}`}>
                <CheckSquare size={11} />
                <span style={{ fontWeight: 600 }}>{task.completed_subtasks}/{task.total_subtasks}</span>
                <div style={{ width: '48px', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', display: 'inline-block' }}>
                  <div style={{
                    height: '100%',
                    width: `${(task.completed_subtasks / task.total_subtasks) * 100}%`,
                    background: task.completed_subtasks === task.total_subtasks ? 'var(--priority-low)' : 'var(--accent-primary)',
                    borderRadius: '2px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}
          </div>

          {/* Assignee Avatar */}
          {task.assignee_name ? (
            <div
              className="avatar"
              style={{ width: '20px', height: '20px', fontSize: '0.65rem' }}
              title={`Assigned to ${task.assignee_name}`}
            >
              {task.assignee_name[0]}
            </div>
          ) : (
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: '1px dashed var(--glass-border)',
                background: 'rgba(255,255,255,0.02)'
              }}
              title="Unassigned"
            />
          )}
        </div>
      </div>
    </div>
  );
}
