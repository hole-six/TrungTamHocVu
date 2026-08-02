"use client";

import FormGuide from "@/components/ui/FormGuide";

type GuideSection = {
  title: string;
  items: string[];
  tone?: "info" | "success" | "warning";
};

export default function PageGuide({
  title,
  summary,
  sections,
  buttonLabel = "Guide màn hình",
}: {
  title: string;
  summary: string;
  sections: GuideSection[];
  buttonLabel?: string;
}) {
  return <FormGuide title={title} summary={summary} sections={sections} position="floating" buttonLabel={buttonLabel} />;
}
