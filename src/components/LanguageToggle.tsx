"use client";

import type { Language } from "./uiLanguage";

type LanguageToggleProps = {
  language: Language;
  label: string;
  onChange: (language: Language) => void;
  testIdPrefix?: string;
};

export default function LanguageToggle({ language, label, onChange, testIdPrefix = "language" }: LanguageToggleProps) {
  return (
    <div className="flex border border-[var(--line)] bg-white text-xs font-semibold" aria-label={label}>
      <button type="button" onClick={() => onChange("zh")} className={`focus-ring px-2 py-1 ${language === "zh" ? "bg-[var(--ink)] text-white" : "text-[var(--ink)]"}`} data-testid={`${testIdPrefix}-zh`}>
        中文
      </button>
      <button type="button" onClick={() => onChange("en")} className={`focus-ring px-2 py-1 ${language === "en" ? "bg-[var(--ink)] text-white" : "text-[var(--ink)]"}`} data-testid={`${testIdPrefix}-en`}>
        English
      </button>
    </div>
  );
}
