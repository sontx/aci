import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

export function MarkdownViewer({
  content,
}: {
  content: string | null | undefined;
}) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        a: ({ ...props }) => (
          <a
            className="text-blue-600 underline hover:text-blue-800"
            {...props}
          />
        ),
      }}
    >
      {content}
    </Markdown>
  );
}
