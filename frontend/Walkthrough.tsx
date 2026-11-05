import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
const steps = [
  {
    icon: FileText,
    eyebrow: '01 / YOUR CREATIVE SPACE',
    title: 'Start with your draft.',
    text: 'Write or paste your content in the editor. Choose the channel and add optional artwork. Your original wording stays in the audit history.',
    selector: '.editor-panel',
  },
  {
    icon: BookOpen,
    eyebrow: '02 / THE SOURCE OF TRUTH',
    title: 'Bring your brand rules.',
    text: 'Open Brand guidelines to read your active sources. Managers and admins can upload and activate rules; creators can inspect every cited source.',
    selector: '.workspace-select',
  },
  {
    icon: Sparkles,
    eyebrow: '03 / A SECOND PAIR OF EYES',
    title: 'Run a compliance audit.',
    text: 'Use Run Compliance Audit to check your draft against active guidelines. Your environment label tells you whether the review uses live AI or offline rules.',
    selector: '.run-area',
  },
  {
    icon: Check,
    eyebrow: '04 / YOU ARE IN CONTROL',
    title: 'Consider every suggestion.',
    text: 'Click a highlighted phrase to find its explanation and source. Accept a rewrite to replace that text, or reject it to keep the wording. Rejected findings remain visible risks.',
    selector: '.analysis-panel',
  },
  {
    icon: ShieldCheck,
    eyebrow: '05 / THE HUMAN HANDOFF',
    title: 'Finish with a human review.',
    text: 'Resolve findings, add context, and send the revision to your manager. They can inspect the diff, request changes, and sign off a compliant revision. You can replay this tour from the navigation.',
    selector: '.handoff',
  },
];
export function Walkthrough({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const step = steps[index];
  const Icon = step.icon;
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const y = window.scrollY;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus({ preventScroll: true });
      window.scrollTo({ top: y, behavior: 'instant' });
    };
  }, []);
  useEffect(() => {
    const target = document.querySelector(steps[index].selector);
    target?.classList.add('tour-target');
    return () => target?.classList.remove('tour-target');
  }, [index]);
  return (
    <dialog
      ref={dialog}
      className="tour-dialog"
      aria-labelledby="tour-title"
      aria-describedby="tour-description"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="tour-top">
        <span>THE BRANDGUARD WALKTHROUGH</span>
        <button onClick={onClose} aria-label="Close walkthrough">
          <X size={20} />
        </button>
      </div>
      <div className="tour-content">
        <div className="tour-illustration" aria-hidden="true">
          <Icon size={44} />
          <span>{String(index + 1).padStart(2, '0')}</span>
        </div>
        <div className="eyebrow">{step.eyebrow}</div>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-description">{step.text}</p>
      </div>
      <div className="tour-progress" aria-label={`Step ${index + 1} of ${steps.length}`}>
        {steps.map((s, i) => (
          <button
            key={s.title}
            aria-label={`Go to step ${i + 1}`}
            aria-current={index === i ? 'step' : undefined}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
      <footer className="tour-controls">
        <button className="quiet" onClick={onClose}>
          Skip tour
        </button>
        <div>
          <button
            className="secondary"
            onClick={() => setIndex((i) => i - 1)}
            disabled={index === 0}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            className="primary"
            onClick={() => (index === steps.length - 1 ? onClose() : setIndex((i) => i + 1))}
          >
            {index === steps.length - 1 ? 'Finish tour' : 'Next'}
            {index === steps.length - 1 ? <Check size={16} /> : <ArrowRight size={16} />}
          </button>
        </div>
      </footer>
      <p className="tour-optional">Always optional. Replay from “Take a tour” anytime.</p>
    </dialog>
  );
}
