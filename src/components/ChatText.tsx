import React from 'react';
import { parseChatText } from '../utils/chatText';

/** Renders React text nodes only, so a reply can never inject HTML. */
export const ChatText: React.FC<{ text: string }> = ({ text }) => (
  <div className="break-words">
    {parseChatText(text).map((line, index) => {
      const content = line.parts.map((part, partIndex) =>
        part.isBold ? <strong key={partIndex}>{part.text}</strong> : part.text
      );

      if (line.isBullet) {
        return (
          <div key={index} className="flex gap-2 pl-1">
            <span aria-hidden="true">•</span>
            <span className="min-w-0">{content}</span>
          </div>
        );
      }
      return line.parts.length > 0 ? (
        <div key={index}>{content}</div>
      ) : (
        <div key={index} className="h-2" />
      );
    })}
  </div>
);
