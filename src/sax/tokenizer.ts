/**
 * XML tokenizer — character-by-character state machine that tokenizes raw XML
 * into structured events. No entity resolution — just raw token emission.
 */

export enum TokenType {
  OpenTag = "OpenTag",
  CloseTag = "CloseTag",
  SelfCloseTag = "SelfCloseTag",
  Attribute = "Attribute",
  Text = "Text",
  CDATA = "CDATA",
  Comment = "Comment",
  ProcessingInstruction = "ProcessingInstruction",
  DocType = "DocType",
}

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface Token {
  type: TokenType;
  value: string;
  name?: string; // tag name, attribute name, PI target
  position: Position;
}

const enum State {
  TEXT,
  TAG_OPEN,           // saw '<'
  TAG_NAME,           // reading tag name
  TAG_SPACE,          // after tag name, before attrs or close
  CLOSE_TAG,          // saw '</'
  CLOSE_TAG_NAME,     // reading close tag name
  CLOSE_TAG_SPACE,    // after close tag name, before '>'
  SELF_CLOSE,         // saw '/' inside a tag (expecting '>')
  ATTR_NAME,          // reading attribute name
  ATTR_AFTER_NAME,    // after attr name, before '='
  ATTR_AFTER_EQ,      // after '=', before value
  ATTR_VALUE_DQ,      // reading double-quoted attr value
  ATTR_VALUE_SQ,      // reading single-quoted attr value
  ATTR_VALUE_UQ,      // reading unquoted attr value (lenient)
  COMMENT_START_1,    // saw '<!-'
  COMMENT,            // inside comment
  COMMENT_END_1,      // saw '-' in comment
  COMMENT_END_2,      // saw '--' in comment
  CDATA_START,        // saw '<![' partial match
  CDATA,              // inside CDATA
  CDATA_END_1,        // saw ']' in CDATA
  CDATA_END_2,        // saw ']]' in CDATA
  PI,                 // saw '<?'
  PI_TARGET,          // reading PI target name
  PI_BODY,            // reading PI body
  PI_END,             // saw '?' in PI body
  DOCTYPE,            // saw '<!DOCTYPE'
  BANG,               // saw '<!'
  BANG_D,             // partial DOCTYPE/CDATA match
}

export interface TokenizerOptions {
  strict?: boolean;
}

type TokenCallback = (token: Token) => void;

export class Tokenizer {
  private state: State = State.TEXT;
  private strict: boolean;
  private buffer = "";
  private tagName = "";
  private attrName = "";
  private attrValue = "";
  private piTarget = "";
  private piBody = "";
  private commentBuffer = "";
  private cdataBuffer = "";
  private doctypeBuffer = "";
  private bangBuffer = "";

  private line = 1;
  private column = 1;
  private offset = 0;

  // Position at start of current token
  private tokenLine = 1;
  private tokenColumn = 1;
  private tokenOffset = 0;

  private onToken: TokenCallback;

  constructor(onToken: TokenCallback, options?: TokenizerOptions) {
    this.onToken = onToken;
    this.strict = options?.strict ?? true;
  }

  private pos(): Position {
    return { line: this.tokenLine, column: this.tokenColumn, offset: this.tokenOffset };
  }

  private savePos(): void {
    this.tokenLine = this.line;
    this.tokenColumn = this.column;
    this.tokenOffset = this.offset;
  }

  private emit(type: TokenType, value: string, name?: string): void {
    const token: Token = { type, value, position: this.pos() };
    if (name !== undefined) token.name = name;
    this.onToken(token);
  }

  private error(msg: string): void {
    if (this.strict) {
      throw new Error(`XML Error: ${msg} at line ${this.line}, column ${this.column}`);
    }
  }

  private flushText(): void {
    if (this.buffer.length > 0) {
      this.emit(TokenType.Text, this.buffer);
      this.buffer = "";
    }
  }

  feed(chunk: string): void {
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      this.processChar(c);
      if (c === "\n") {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.offset++;
    }
  }

  close(): void {
    // Flush any remaining text
    this.flushText();

    // Check for unclosed state
    if (this.state !== State.TEXT) {
      this.error("Unexpected end of input");
      // In lenient mode, try to recover
      switch (this.state) {
        case State.COMMENT:
        case State.COMMENT_END_1:
        case State.COMMENT_END_2:
          this.emit(TokenType.Comment, this.commentBuffer);
          break;
        case State.CDATA:
        case State.CDATA_END_1:
        case State.CDATA_END_2:
          this.emit(TokenType.CDATA, this.cdataBuffer);
          break;
        case State.PI:
        case State.PI_TARGET:
        case State.PI_BODY:
        case State.PI_END:
          this.emit(TokenType.ProcessingInstruction, this.piBody, this.piTarget);
          break;
      }
      this.state = State.TEXT;
    }
  }

  private processChar(c: string): void {
    switch (this.state) {
      case State.TEXT:
        if (c === "<") {
          this.flushText();
          this.savePos();
          this.state = State.TAG_OPEN;
        } else {
          if (this.buffer.length === 0) this.savePos();
          this.buffer += c;
        }
        break;

      case State.TAG_OPEN:
        if (c === "/") {
          this.state = State.CLOSE_TAG;
          this.tagName = "";
        } else if (c === "?") {
          this.state = State.PI_TARGET;
          this.piTarget = "";
          this.piBody = "";
        } else if (c === "!") {
          this.state = State.BANG;
          this.bangBuffer = "";
        } else if (isNameStartChar(c)) {
          this.state = State.TAG_NAME;
          this.tagName = c;
        } else {
          this.error(`Unexpected character '${c}' after '<'`);
          // Lenient: treat as text
          this.buffer += "<" + c;
          this.state = State.TEXT;
        }
        break;

      case State.TAG_NAME:
        if (isWhitespace(c)) {
          this.emit(TokenType.OpenTag, this.tagName, this.tagName);
          this.state = State.TAG_SPACE;
        } else if (c === "/") {
          this.emit(TokenType.OpenTag, this.tagName, this.tagName);
          this.state = State.SELF_CLOSE;
        } else if (c === ">") {
          this.emit(TokenType.OpenTag, this.tagName, this.tagName);
          this.state = State.TEXT;
        } else if (isNameChar(c)) {
          this.tagName += c;
        } else {
          this.error(`Invalid character '${c}' in tag name`);
          this.tagName += c;
        }
        break;

      case State.TAG_SPACE:
        if (isWhitespace(c)) {
          // skip
        } else if (c === "/") {
          this.state = State.SELF_CLOSE;
        } else if (c === ">") {
          this.state = State.TEXT;
        } else if (isNameStartChar(c)) {
          this.savePos();
          this.attrName = c;
          this.attrValue = "";
          this.state = State.ATTR_NAME;
        } else {
          this.error(`Unexpected character '${c}' in tag`);
        }
        break;

      case State.ATTR_NAME:
        if (c === "=") {
          this.state = State.ATTR_AFTER_EQ;
        } else if (isWhitespace(c)) {
          this.state = State.ATTR_AFTER_NAME;
        } else if (c === "/" || c === ">") {
          // Attribute with no value (lenient) — treat as boolean
          this.emit(TokenType.Attribute, this.attrName, this.attrName);
          if (c === "/") {
            this.state = State.SELF_CLOSE;
          } else {
            this.state = State.TEXT;
          }
        } else if (isNameChar(c)) {
          this.attrName += c;
        } else {
          this.error(`Invalid character '${c}' in attribute name`);
          this.attrName += c;
        }
        break;

      case State.ATTR_AFTER_NAME:
        if (c === "=") {
          this.state = State.ATTR_AFTER_EQ;
        } else if (isWhitespace(c)) {
          // skip
        } else {
          // Attribute with no value
          this.emit(TokenType.Attribute, this.attrName, this.attrName);
          if (c === "/") {
            this.state = State.SELF_CLOSE;
          } else if (c === ">") {
            this.state = State.TEXT;
          } else if (isNameStartChar(c)) {
            this.savePos();
            this.attrName = c;
            this.attrValue = "";
            this.state = State.ATTR_NAME;
          } else {
            this.error(`Unexpected character '${c}'`);
            this.state = State.TAG_SPACE;
          }
        }
        break;

      case State.ATTR_AFTER_EQ:
        if (c === '"') {
          this.attrValue = "";
          this.state = State.ATTR_VALUE_DQ;
        } else if (c === "'") {
          this.attrValue = "";
          this.state = State.ATTR_VALUE_SQ;
        } else if (isWhitespace(c)) {
          // skip
        } else if (!this.strict) {
          // Lenient: unquoted attribute value
          this.attrValue = c;
          this.state = State.ATTR_VALUE_UQ;
        } else {
          this.error(`Expected quote after '=' for attribute '${this.attrName}'`);
          this.attrValue = c;
          this.state = State.ATTR_VALUE_UQ;
        }
        break;

      case State.ATTR_VALUE_DQ:
        if (c === '"') {
          this.emit(TokenType.Attribute, this.attrValue, this.attrName);
          this.state = State.TAG_SPACE;
        } else {
          this.attrValue += c;
        }
        break;

      case State.ATTR_VALUE_SQ:
        if (c === "'") {
          this.emit(TokenType.Attribute, this.attrValue, this.attrName);
          this.state = State.TAG_SPACE;
        } else {
          this.attrValue += c;
        }
        break;

      case State.ATTR_VALUE_UQ:
        if (isWhitespace(c)) {
          this.emit(TokenType.Attribute, this.attrValue, this.attrName);
          this.state = State.TAG_SPACE;
        } else if (c === ">") {
          this.emit(TokenType.Attribute, this.attrValue, this.attrName);
          this.state = State.TEXT;
        } else if (c === "/") {
          this.emit(TokenType.Attribute, this.attrValue, this.attrName);
          this.state = State.SELF_CLOSE;
        } else {
          this.attrValue += c;
        }
        break;

      case State.SELF_CLOSE:
        if (c === ">") {
          this.emit(TokenType.SelfCloseTag, this.tagName, this.tagName);
          this.state = State.TEXT;
        } else {
          this.error(`Expected '>' after '/'`);
          // Lenient: go back to tag space
          this.state = State.TAG_SPACE;
          this.processChar(c);
        }
        break;

      case State.CLOSE_TAG:
        if (isNameStartChar(c)) {
          this.tagName = c;
          this.state = State.CLOSE_TAG_NAME;
        } else {
          this.error(`Expected tag name after '</'`);
          this.buffer += "</" + c;
          this.state = State.TEXT;
        }
        break;

      case State.CLOSE_TAG_NAME:
        if (c === ">") {
          this.emit(TokenType.CloseTag, this.tagName, this.tagName);
          this.state = State.TEXT;
        } else if (isWhitespace(c)) {
          this.state = State.CLOSE_TAG_SPACE;
        } else if (isNameChar(c)) {
          this.tagName += c;
        } else {
          this.error(`Invalid character '${c}' in close tag name`);
          this.tagName += c;
        }
        break;

      case State.CLOSE_TAG_SPACE:
        if (c === ">") {
          this.emit(TokenType.CloseTag, this.tagName, this.tagName);
          this.state = State.TEXT;
        } else if (!isWhitespace(c)) {
          this.error(`Expected '>' in close tag`);
        }
        break;

      case State.BANG:
        // After '<!'
        if (c === "-") {
          this.state = State.COMMENT_START_1;
        } else if (c === "[") {
          this.state = State.CDATA_START;
          this.bangBuffer = "";
        } else if (c === "D" || c === "d") {
          this.state = State.BANG_D;
          this.bangBuffer = c;
        } else {
          this.error(`Unexpected character '${c}' after '<!'`);
          this.buffer += "<!" + c;
          this.state = State.TEXT;
        }
        break;

      case State.COMMENT_START_1:
        if (c === "-") {
          this.commentBuffer = "";
          this.state = State.COMMENT;
        } else {
          this.error("Expected '--' to start comment");
          this.buffer += "<!-" + c;
          this.state = State.TEXT;
        }
        break;

      case State.COMMENT:
        if (c === "-") {
          this.state = State.COMMENT_END_1;
        } else {
          this.commentBuffer += c;
        }
        break;

      case State.COMMENT_END_1:
        if (c === "-") {
          this.state = State.COMMENT_END_2;
        } else {
          this.commentBuffer += "-" + c;
          this.state = State.COMMENT;
        }
        break;

      case State.COMMENT_END_2:
        if (c === ">") {
          this.emit(TokenType.Comment, this.commentBuffer);
          this.state = State.TEXT;
        } else if (c === "-") {
          // '---' sequence, add one '-' to buffer
          this.commentBuffer += "-";
        } else {
          this.error("'--' not allowed inside comment");
          this.commentBuffer += "--" + c;
          this.state = State.COMMENT;
        }
        break;

      case State.CDATA_START:
        // Expecting 'CDATA['
        this.bangBuffer += c;
        if ("CDATA[".startsWith(this.bangBuffer)) {
          if (this.bangBuffer === "CDATA[") {
            this.cdataBuffer = "";
            this.state = State.CDATA;
          }
        } else {
          this.error(`Expected '<![CDATA[', got '<![${this.bangBuffer}'`);
          this.buffer += "<![" + this.bangBuffer;
          this.state = State.TEXT;
        }
        break;

      case State.CDATA:
        if (c === "]") {
          this.state = State.CDATA_END_1;
        } else {
          this.cdataBuffer += c;
        }
        break;

      case State.CDATA_END_1:
        if (c === "]") {
          this.state = State.CDATA_END_2;
        } else {
          this.cdataBuffer += "]" + c;
          this.state = State.CDATA;
        }
        break;

      case State.CDATA_END_2:
        if (c === ">") {
          this.emit(TokenType.CDATA, this.cdataBuffer);
          this.state = State.TEXT;
        } else if (c === "]") {
          // extra ']' — add one to buffer
          this.cdataBuffer += "]";
        } else {
          this.cdataBuffer += "]]" + c;
          this.state = State.CDATA;
        }
        break;

      case State.BANG_D:
        // Matching 'OCTYPE'
        this.bangBuffer += c;
        const target = "DOCTYPE";
        if (target.toUpperCase().startsWith(this.bangBuffer.toUpperCase())) {
          if (this.bangBuffer.length === target.length) {
            this.doctypeBuffer = "";
            this.state = State.DOCTYPE;
          }
        } else {
          this.error(`Expected '<!DOCTYPE', got '<!${this.bangBuffer}'`);
          this.buffer += "<!" + this.bangBuffer;
          this.state = State.TEXT;
        }
        break;

      case State.DOCTYPE: {
        // Read until matching '>' (handle nested brackets)
        if (c === ">") {
          this.emit(TokenType.DocType, this.doctypeBuffer.trim());
          this.state = State.TEXT;
        } else {
          this.doctypeBuffer += c;
        }
        break;
      }

      case State.PI_TARGET:
        if (isWhitespace(c)) {
          this.state = State.PI_BODY;
        } else if (c === "?") {
          this.state = State.PI_END;
        } else {
          this.piTarget += c;
        }
        break;

      case State.PI_BODY:
        if (c === "?") {
          this.state = State.PI_END;
        } else {
          this.piBody += c;
        }
        break;

      case State.PI_END:
        if (c === ">") {
          this.emit(TokenType.ProcessingInstruction, this.piBody, this.piTarget);
          this.state = State.TEXT;
        } else {
          this.piBody += "?" + c;
          this.state = State.PI_BODY;
        }
        break;
    }
  }
}

function isWhitespace(c: string): boolean {
  return c === " " || c === "\t" || c === "\n" || c === "\r";
}

function isNameStartChar(c: string): boolean {
  const code = c.charCodeAt(0);
  return (
    (code >= 0x41 && code <= 0x5a) || // A-Z
    (code >= 0x61 && code <= 0x7a) || // a-z
    c === "_" ||
    c === ":" ||
    (code >= 0xc0 && code <= 0xd6) ||
    (code >= 0xd8 && code <= 0xf6) ||
    (code >= 0xf8 && code <= 0x2ff) ||
    (code >= 0x370 && code <= 0x37d) ||
    (code >= 0x37f && code <= 0x1fff) ||
    (code >= 0x200c && code <= 0x200d) ||
    (code >= 0x2070 && code <= 0x218f) ||
    (code >= 0x2c00 && code <= 0x2fef) ||
    (code >= 0x3001 && code <= 0xd7ff) ||
    (code >= 0xf900 && code <= 0xfdcf) ||
    (code >= 0xfdf0 && code <= 0xfffd)
  );
}

function isNameChar(c: string): boolean {
  if (isNameStartChar(c)) return true;
  const code = c.charCodeAt(0);
  return (
    c === "-" ||
    c === "." ||
    (code >= 0x30 && code <= 0x39) || // 0-9
    code === 0xb7 ||
    (code >= 0x300 && code <= 0x36f) ||
    (code >= 0x203f && code <= 0x2040)
  );
}
