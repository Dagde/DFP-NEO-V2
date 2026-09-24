import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  answerNeoGuideClarificationNone,
  answerNeoGuideClarificationSelection,
  answerNeoGuideQuestion,
  NeoGuideClarificationOption,
  NeoGuideAnswer,
  NeoGuideConversationState,
  NeoGuideLearnedAssociation,
  NeoGuideNavigationAction,
  NeoGuideRuntimeModel,
} from '../utils/neoGuideEngine';

interface NeoGuidePanelProps {
  isOpen: boolean;
  activeView: string;
  selectedRecordLabel?: string;
  canUsePlatformPermission?: (permissionId: string) => boolean;
  onNavigate: (view: string, action?: NeoGuideNavigationAction) => void;
  onClose: () => void;
}

interface GuideMessage {
  id: string;
  role: 'guide' | 'user';
  text: string;
  action?: NeoGuideNavigationAction;
  clarificationOptions?: NeoGuideClarificationOption[];
  noneOptionLabel?: string;
}

interface NeoGuideDatabaseVocabulary {
  terminologyIndex?: NonNullable<NeoGuideRuntimeModel['terminologyIndex']>;
}

const pageToView: Record<string, string> = {
  'Program Schedule': 'Program Schedule',
  'Training Records': 'TrainingRecords',
  'Course Progress': 'CourseProgress',
  Trainee: 'Trainee',
  Staff: 'Staff',
  Settings: 'Settings',
  Priorities: 'Priorities',
  SupervisorDashboard: 'SupervisorDashboard',
};
const LEARNED_ASSOCIATIONS_KEY = 'dfp-neo-guide-learned-associations.v1';

const normaliseLearnedPhrase = (value: string) => value
  .toLowerCase()
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const loadLearnedAssociations = (): NeoGuideLearnedAssociation[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEARNED_ASSOCIATIONS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 250) : [];
  } catch {
    return [];
  }
};

const saveLearnedAssociations = (associations: NeoGuideLearnedAssociation[]) => {
  window.localStorage.setItem(LEARNED_ASSOCIATIONS_KEY, JSON.stringify(associations.slice(0, 250)));
};

const highlightTarget = (target?: string | null) => {
  if (!target) return false;
  const element = document.querySelector(`[data-neo-guide="${CSS.escape(target)}"]`) as HTMLElement | null;
  if (!element) return false;
  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  element.classList.remove('neo-guide-target-highlight');
  void element.offsetWidth;
  element.classList.add('neo-guide-target-highlight');
  window.setTimeout(() => element.classList.remove('neo-guide-target-highlight'), 3600);
  return true;
};

const getActionTargetLabel = (action: NeoGuideNavigationAction) => (
  action.page || action.anchor || action.label || 'that location'
);

const mergeDatabaseVocabulary = (
  baseModel: NeoGuideRuntimeModel,
  databaseVocabulary: NeoGuideDatabaseVocabulary | null
): NeoGuideRuntimeModel => {
  const databaseTerms = Array.isArray(databaseVocabulary?.terminologyIndex)
    ? databaseVocabulary.terminologyIndex
    : [];
  if (!databaseTerms.length) return baseModel;
  return {
    ...baseModel,
    terminologyIndex: [
      ...(baseModel.terminologyIndex || []),
      ...databaseTerms.map((entry) => ({
        ...entry,
        sources: entry.sources?.length ? entry.sources : ['customer-database-vocabulary'],
      })),
    ],
  };
};

const NeoGuidePanel: React.FC<NeoGuidePanelProps> = ({
  isOpen,
  activeView,
  selectedRecordLabel,
  canUsePlatformPermission,
  onNavigate,
  onClose,
}) => {
  const [model, setModel] = useState<NeoGuideRuntimeModel | null>(null);
  const [loadError, setLoadError] = useState('');
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState<NeoGuideConversationState | null>(null);
  const [learnedAssociations, setLearnedAssociations] = useState<NeoGuideLearnedAssociation[]>([]);
  const [messages, setMessages] = useState<GuideMessage[]>([
    {
      id: 'welcome',
      role: 'guide',
      text: 'What can I help you with?',
    },
  ]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const latestMessageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchJson = (url: string, optional = false) => fetch(url, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) {
          if (optional) return null;
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      });

    Promise.all([
      fetchJson('/neo-guide/dfp-neo-knowledge-model.json'),
      fetchJson('/neo-guide/db-vocabulary.json', true),
    ])
      .then(([nextModel, databaseVocabulary]) => {
        if (!cancelled) setModel(mergeDatabaseVocabulary(nextModel, databaseVocabulary));
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isOpen) window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      latestMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, messages.length, loadError]);

  useEffect(() => {
    setLearnedAssociations(loadLearnedAssociations());
  }, []);

  const userPermissions = useMemo(() => {
    if (!model || !canUsePlatformPermission) return [];
    const ids = new Set<string>();
    (model.curatedKnowledge?.functions || []).forEach((fn) => {
      (fn.permissions || []).forEach((permission) => ids.add(permission));
    });
    return Array.from(ids).filter((permission) => canUsePlatformPermission(permission));
  }, [canUsePlatformPermission, model]);

  const submitQuestion = (event?: React.FormEvent) => {
    event?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || !model) return;
    const guideContext = {
      page: activeView,
      selectedRecordLabel,
      userPermissions,
      conversation,
      learnedAssociations,
    };
    const answer: NeoGuideAnswer = answerNeoGuideQuestion(trimmed, model, {
      ...guideContext,
    });
    appendAnswer(trimmed, answer);
    setQuestion('');
  };

  const appendAnswer = (userText: string | null, answer: NeoGuideAnswer) => {
    setConversation(answer.conversation);
    setMessages((current) => [
      ...current,
      ...(userText ? [{ id: `user-${Date.now()}`, role: 'user' as const, text: userText }] : []),
      {
        id: `guide-${Date.now()}`,
        role: 'guide' as const,
        text: answer.answer,
        action: answer.navigationAction,
        clarificationOptions: answer.clarificationOptions,
        noneOptionLabel: answer.resolutionStage === 3
          ? "None of these - I'll rephrase my question"
          : answer.clarificationOptions?.length
            ? 'None of these'
            : undefined,
      },
    ]);
  };

  const appendGuideMessage = (text: string, action?: NeoGuideNavigationAction) => {
    setMessages((current) => [
      ...current,
      { id: `guide-${Date.now()}-${current.length}`, role: 'guide', text, action },
    ]);
  };

  const selectClarificationOption = (option: NeoGuideClarificationOption) => {
    if (!model) return;
    const originalQuestion = conversation?.resolution?.originalQuestion;
    if (originalQuestion) {
      const normalisedPhrase = normaliseLearnedPhrase(originalQuestion);
      if (normalisedPhrase) {
        setLearnedAssociations((current) => {
          const existing = current.find((item) => item.normalisedPhrase === normalisedPhrase && item.intentId === option.intentId);
          const next = existing
            ? current.map((item) => item === existing
              ? { ...item, count: item.count + 1, lastSelectedAt: new Date().toISOString() }
              : item)
            : [
              {
                phrase: originalQuestion,
                normalisedPhrase,
                intentId: option.intentId,
                count: 1,
                lastSelectedAt: new Date().toISOString(),
              },
              ...current,
            ];
          saveLearnedAssociations(next);
          return next.slice(0, 250);
        });
      }
    }
    const answer = answerNeoGuideClarificationSelection(option.intentId, model, {
      page: activeView,
      selectedRecordLabel,
      userPermissions,
      conversation,
      learnedAssociations,
    });
    appendAnswer(option.label, answer);
  };

  const selectNoneOfThese = () => {
    if (!model) return;
    const answer = answerNeoGuideClarificationNone(model, {
      page: activeView,
      selectedRecordLabel,
      userPermissions,
      conversation,
      learnedAssociations,
    });
    appendAnswer('None of these', answer);
    window.setTimeout(() => inputRef.current?.focus(), 80);
  };

  const tryHighlightActionTarget = (action: NeoGuideNavigationAction, attempt = 0, didNavigate = false) => {
    const found = highlightTarget(action.highlightTarget || action.anchor);
    if (found) {
      if (attempt > 0 && didNavigate) appendGuideMessage(`I opened ${getActionTargetLabel(action)} and highlighted the relevant area.`);
      return;
    }
    if (attempt < 5) {
      window.setTimeout(() => tryHighlightActionTarget(action, attempt + 1, didNavigate), 220);
      return;
    }
    const prefix = didNavigate
      ? `I opened ${getActionTargetLabel(action)}.`
      : `I looked for ${getActionTargetLabel(action)}.`;
    appendGuideMessage(`${prefix} Follow the steps above; the final control may only appear after you open the relevant tab, drawer, record or section.`);
  };

  const performAction = (action: NeoGuideNavigationAction) => {
    const view = action.page ? pageToView[action.page] : null;
    if (view && view !== activeView) {
      onNavigate(view, action);
      window.setTimeout(() => tryHighlightActionTarget(action, 0, true), 260);
      return;
    }
    if (view === activeView && action.settingsSectionId) {
      onNavigate(view, action);
      window.setTimeout(() => tryHighlightActionTarget(action, 0, true), 260);
      return;
    }
    tryHighlightActionTarget(action);
  };

  return (
    <>
      <style>{`
        .neo-guide-target-highlight {
          animation: neoGuideTargetPulse 3.4s ease-out;
          outline: 2px solid rgba(251, 146, 60, 0.98) !important;
          outline-offset: 4px !important;
          box-shadow: 0 0 0 5px rgba(251, 146, 60, 0.18), 0 0 28px rgba(251, 146, 60, 0.52) !important;
        }
        @keyframes neoGuideTargetPulse {
          0% { box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.55), 0 0 0 rgba(251, 146, 60, 0.3); }
          52% { box-shadow: 0 0 0 8px rgba(251, 146, 60, 0.22), 0 0 30px rgba(251, 146, 60, 0.55); }
          100% { box-shadow: 0 0 0 5px rgba(251, 146, 60, 0.0), 0 0 0 rgba(251, 146, 60, 0.0); }
        }
      `}</style>
      {isOpen && (
        <section
          data-neo-guide="neo-guide-panel"
          className="fixed bottom-20 right-[128px] z-[1400] flex h-[520px] w-[420px] max-w-[calc(100vw-180px)] flex-col overflow-hidden rounded-lg border border-orange-300/50 bg-slate-950 text-slate-100 shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
          aria-label="NEO Guide"
        >
          <header className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-3">
            <div>
              <h2 className="text-base font-black text-white">NEO Guide</h2>
              <p className="text-xs font-semibold text-slate-400">What can I help you with?</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-600 px-2 py-1 text-xs font-bold text-slate-300 hover:border-slate-400 hover:text-white"
            >
              Close
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {loadError ? (
              <div className="rounded-md border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-100">
                NEO Guide knowledge could not be loaded: {loadError}
              </div>
            ) : null}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-md border px-3 py-2 text-sm leading-5 ${
                  message.role === 'user'
                    ? 'ml-8 border-sky-400/30 bg-sky-950/30 text-sky-50'
                    : 'mr-8 border-slate-700 bg-slate-900/80 text-slate-100'
                }`}
              >
                <p className="whitespace-pre-line">{message.text}</p>
                {message.action ? (
                  <button
                    type="button"
                    onClick={() => performAction(message.action as NeoGuideNavigationAction)}
                    className="mt-3 rounded-md border border-orange-300/60 bg-orange-500 px-3 py-1.5 text-xs font-black text-slate-950 hover:bg-orange-400"
                  >
                    {message.action.label}
                  </button>
                ) : null}
                {message.clarificationOptions?.length ? (
                  <div className="mt-3 space-y-2">
                    {message.clarificationOptions.map((option) => (
                      <button
                        key={option.intentId}
                        type="button"
                        onClick={() => selectClarificationOption(option)}
                        className="block w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-left text-xs font-bold text-slate-100 hover:border-orange-300 hover:bg-slate-700"
                      >
                        {option.label}
                      </button>
                    ))}
                    {message.noneOptionLabel ? (
                      <button
                        type="button"
                        onClick={selectNoneOfThese}
                        className="block w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-left text-xs font-bold text-slate-300 hover:border-slate-400 hover:text-white"
                      >
                        {message.noneOptionLabel}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
            <div ref={latestMessageRef} aria-hidden="true" />
          </div>

          <form onSubmit={submitQuestion} className="border-t border-slate-700 bg-slate-900 p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={!model}
                placeholder={model ? 'Ask how to do something...' : 'Loading NEO Guide...'}
                className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-orange-300"
              />
              <button
                type="submit"
                disabled={!model || !question.trim()}
                className="rounded-md border border-orange-300/60 bg-orange-500 px-3 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Ask
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
};

export default NeoGuidePanel;
