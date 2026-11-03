import { memo, useId, useMemo } from "react";
import DOMPurify from "dompurify";

export type HtmlProps = {
  children: string;
  id?: string;
  className?: string;
};

const MemoizedHtmlBlock = memo(
  function HtmlBlock({ content }: { content: string }) {
    const sanitizedHtml = useMemo(
      () =>
        DOMPurify.sanitize(content, {
          USE_PROFILES: { html: true },
        }),
      [content]
    );

    return (
      <div
        dangerouslySetInnerHTML={{
          __html: sanitizedHtml,
        }}
      />
    );
  },
  (prevProps, nextProps) => prevProps.content === nextProps.content
);

MemoizedHtmlBlock.displayName = "MemoizedHtmlBlock";

function HtmlComponent({
  children,
  id,
  className,
}: HtmlProps) {
  const generatedId = useId();
  const blockId = id ?? generatedId;

  const sanitizedHtml = useMemo(
    () =>
      DOMPurify.sanitize(children, {
        USE_PROFILES: { html: true },
      }),
    [children]
  );

  return (
    <div
      id={blockId}
      className={className}
      dangerouslySetInnerHTML={{
        __html: sanitizedHtml,
      }}
    />
  );
}

const Html = memo(HtmlComponent);
Html.displayName = "Html";

export { Html };