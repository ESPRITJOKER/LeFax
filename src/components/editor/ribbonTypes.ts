import type { CellAlign, HighlightColor } from "../../lib/markupSyntax";
import type { BlockStyle, CalloutKind } from "./markupCommands";

/**
 * What the ribbon can ask for.
 *
 * A discriminated union rather than the flat string union the old 19-button
 * toolbar used (`"bold" | "italic" | … ` plus an untyped `arg?: string`). With
 * table operations, a style gallery, alignment, callout boxes, three insert
 * panels and four dialogs, the flat version would have been ~35 members whose
 * arguments the type system could not check — `{ k: "align", align: "center" }`
 * either compiles or it does not, and `MarkupField`'s router gets an
 * exhaustiveness check for free.
 */

export type RibbonPanel = "math" | "chem" | "symbol";
export type RibbonDialog = "link" | "video" | "image";

export type TableOp =
  | { op: "addRow"; where: "above" | "below" }
  | { op: "delRow" }
  | { op: "addCol"; where: "left" | "right" }
  | { op: "delCol" }
  | { op: "colAlign"; align: CellAlign }
  | { op: "toggleHeader" };

export type MarkupCmd =
  | { k: "history"; dir: "undo" | "redo" }
  | { k: "wrap"; mark: "bold" | "italic" | "underline" | "strike" | "sup" | "sub" | "code" }
  | { k: "highlight"; color: HighlightColor }
  | { k: "style"; style: BlockStyle }
  | { k: "list"; ordered: boolean }
  | { k: "shift"; dir: 1 | -1 }
  | { k: "align"; align: CellAlign }
  | { k: "box"; kind: CalloutKind }
  | { k: "quote" }
  | { k: "divider" }
  | { k: "clear" }
  | { k: "insertText"; text: string; select?: string }
  | { k: "panel"; panel: RibbonPanel | null }
  | { k: "dialog"; dialog: RibbonDialog | null }
  | { k: "insertTable"; rows: number; cols: number }
  | { k: "table"; op: TableOp }
  | { k: "source" };

/** Everything the ribbon needs in order to show the right pressed states. */
export interface RibbonState {
  canUndo: boolean;
  canRedo: boolean;
  source: boolean;
  panel: RibbonPanel | null;
  /** Of the line the caret is on. */
  style: BlockStyle;
  align: CellAlign;
  quote: boolean;
  box: CalloutKind | null;
  /** True when the caret is inside a table, which reveals the table group. */
  inTable: boolean;
}

/**
 * Which groups a field gets. This is driven by **what the field's renderer can
 * actually display**, not by how much room there is — offering a tool that
 * writes markup the reader renders as literal text is worse than not offering
 * it at all:
 *
 *   `lesson` — the lesson body, rendered by `LessonContent`. Everything.
 *   `card`   — story-card fields, rendered by `RichCardText`. That renderer
 *              handles headings, lists, tables, quotes, dividers, video and all
 *              the inline marks, but NOT the `[!PIEGE]` / `[!INFO]` / `[!APP]`
 *              boxes — so the boxes group is hidden. The image button is hidden
 *              too, because a card has one image of its own, placed by a bare
 *              `[[IMG]]` token rather than uploaded per placeholder.
 *   `quiz`   — question prompts and explanations, rendered by `inline()` ONLY.
 *              Nothing block-level renders there: a `##` heading, a `- ` list or
 *              a table would all show up verbatim to the student. So this
 *              variant is inline marks, links and the formula panels, and
 *              nothing else.
 */
export type RibbonVariant = "lesson" | "card" | "quiz";

export interface RibbonCapabilities {
  styles: boolean;
  paragraph: boolean;
  boxes: boolean;
  tables: boolean;
  image: boolean;
  video: boolean;
  formulas: boolean;
}

export function capabilitiesFor(variant: RibbonVariant): RibbonCapabilities {
  switch (variant) {
    case "lesson":
      return { styles: true, paragraph: true, boxes: true, tables: true, image: true, video: true, formulas: true };
    case "card":
      return { styles: true, paragraph: true, boxes: false, tables: false, image: false, video: true, formulas: true };
    case "quiz":
      return { styles: false, paragraph: false, boxes: false, tables: false, image: false, video: false, formulas: true };
  }
}
