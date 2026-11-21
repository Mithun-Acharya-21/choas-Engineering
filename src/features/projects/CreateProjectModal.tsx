import React, { useState } from 'react';
import { FolderPlus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ open, onClose }) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createProject, activeTenant } = useAuth();

  if (!open) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    const generated = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    setSlug(generated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await createProject({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
      });
      onClose();
      setName('');
      setSlug('');
      setDescription('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-xs" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-md rounded-lg border border-[#27272a] bg-[#18181b] p-5 shadow-2xl overlay-elevation">
        <div className="flex items-start justify-between border-b border-[#27272a] pb-3">
          <div className="flex items-center gap-2 text-[#fafafa]">
            <FolderPlus className="h-4 w-4 text-[#6366f1]" />
            <h3 className="font-display text-[15px] font-semibold">Create New Project</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-[#71717a] hover:bg-[#202024] hover:text-[#fafafa]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded border border-[#f43f5e]/30 bg-[#f43f5e]/10 p-2 font-mono text-[11px] text-[#f43f5e]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-3.5 space-y-3">
          <div>
            <span className="font-mono text-[10px] text-[#71717a]">
              Tenant Workspace: <span className="text-[#10b981] font-medium">{activeTenant?.name}</span>
            </span>
          </div>

          <div>
            <label htmlFor="modal-project-name" className="mb-1 block font-mono text-[11px] text-[#a1a1aa]">
              Project Name
            </label>
            <input
              id="modal-project-name"
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Payments Resilience"
              className="h-8 w-full rounded border border-[#27272a] bg-[#111113] px-2.5 font-mono text-[12px] text-[#fafafa] focus:border-[#6366f1] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="modal-project-slug" className="mb-1 block font-mono text-[11px] text-[#a1a1aa]">
              Project Slug
            </label>
            <input
              id="modal-project-slug"
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. payments-resilience"
              className="h-8 w-full rounded border border-[#27272a] bg-[#111113] px-2.5 font-mono text-[12px] text-[#a1a1aa] focus:border-[#6366f1] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="modal-project-desc" className="mb-1 block font-mono text-[11px] text-[#a1a1aa]">
              Description (Optional)
            </label>
            <textarea
              id="modal-project-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Testing circuit breakers and timeouts..."
              className="w-full rounded border border-[#27272a] bg-[#111113] p-2 font-mono text-[11px] text-[#fafafa] focus:border-[#6366f1] focus:outline-none"
            />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-[#27272a] pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-[#27272a] bg-[#111113] px-3 py-1.5 font-mono text-[11px] text-[#a1a1aa] hover:bg-[#202024]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded bg-[#6366f1] px-3.5 py-1.5 font-mono text-[11px] font-semibold text-white hover:bg-[#4f46e5] disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
