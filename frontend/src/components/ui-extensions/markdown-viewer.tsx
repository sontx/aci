import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownViewer({
  content,
}: {
  content: string | null | undefined;
}) {
  return <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>;
}
