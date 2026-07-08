"use client";

import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

const puzzle = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9],
];

const solution = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

function emptyBoard() {
  return puzzle.map((row) => row.map((value) => (value ? String(value) : "")));
}

export default function SudokuPage() {
  const [board, setBoard] = useState(emptyBoard);
  const [checked, setChecked] = useState(false);
  const [hintCell, setHintCell] = useState<[number, number] | null>(null);

  const progress = useMemo(() => {
    const filled = board.flat().filter(Boolean).length;
    return `${filled}/81`;
  }, [board]);

  const mistakes = useMemo(() => {
    return board.flatMap((row, rowIndex) =>
      row.flatMap((value, columnIndex) => {
        if (!value) return [];
        return Number(value) === solution[rowIndex][columnIndex]
          ? []
          : [`${rowIndex}-${columnIndex}`];
      }),
    );
  }, [board]);

  const isSolved = board.every((row, rowIndex) =>
    row.every((value, columnIndex) => Number(value) === solution[rowIndex][columnIndex]),
  );

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    if (puzzle[rowIndex][columnIndex]) return;

    const nextValue = value.replace(/\D/g, "").slice(-1);
    setBoard((current) =>
      current.map((row, r) =>
        row.map((cell, c) => (r === rowIndex && c === columnIndex ? nextValue : cell)),
      ),
    );
    setChecked(false);
    setHintCell(null);
  }

  function revealHint() {
    const target = board
      .flatMap((row, rowIndex) =>
        row.map((value, columnIndex) => ({ columnIndex, rowIndex, value })),
      )
      .find(({ columnIndex, rowIndex, value }) => {
        return !puzzle[rowIndex][columnIndex] && Number(value) !== solution[rowIndex][columnIndex];
      });

    if (!target) return;

    setBoard((current) =>
      current.map((row, r) =>
        row.map((cell, c) =>
          r === target.rowIndex && c === target.columnIndex
            ? String(solution[r][c])
            : cell,
        ),
      ),
    );
    setHintCell([target.rowIndex, target.columnIndex]);
    setChecked(false);
  }

  return (
    <main className="min-h-dvh bg-[#f7f7f5] px-4 py-5 text-[#4f5651] sm:py-8">
      <section className="mx-auto flex max-w-xl flex-col gap-4">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a2a8a3]">
              notes
            </p>
            <h1 className="text-xl font-semibold tracking-normal text-[#767d78]">
              Practice grid
            </h1>
          </div>
          <div className="rounded-full border border-[#e2e4e1] bg-[#fbfbfa] px-3 py-1.5 text-sm font-semibold tabular-nums text-[#9aa09b]">
            {progress}
          </div>
        </header>

        <div className="grid aspect-square grid-cols-9 overflow-hidden rounded-md border border-[#cfd4cf] bg-[#fbfbfa] shadow-none">
          {board.map((row, rowIndex) =>
            row.map((value, columnIndex) => {
              const fixed = Boolean(puzzle[rowIndex][columnIndex]);
              const wrong = checked && mistakes.includes(`${rowIndex}-${columnIndex}`);
              const hinted =
                hintCell?.[0] === rowIndex && hintCell?.[1] === columnIndex;

              return (
                <input
                  key={`${rowIndex}-${columnIndex}`}
                  aria-label={`row ${rowIndex + 1}, column ${columnIndex + 1}`}
                  inputMode="numeric"
                  maxLength={1}
                  readOnly={fixed}
                  value={value}
                  onChange={(event) =>
                    updateCell(rowIndex, columnIndex, event.target.value)
                  }
                  className={[
                    "min-w-0 border-[#e5e7e4] text-center text-lg font-medium outline-none transition sm:text-2xl",
                    fixed ? "bg-[#f0f1ef] text-[#858b86]" : "bg-[#fbfbfa] text-[#737b75]",
                    wrong ? "bg-[#f5eeee] text-[#9d7777]" : "",
                    hinted ? "bg-[#f5f2e8] text-[#9a8d68]" : "",
                    columnIndex === 2 || columnIndex === 5 ? "border-r-2 border-r-[#c7ccc7]" : "border-r",
                    rowIndex === 2 || rowIndex === 5 ? "border-b-2 border-b-[#c7ccc7]" : "border-b",
                    columnIndex === 8 ? "border-r-0" : "",
                    rowIndex === 8 ? "border-b-0" : "",
                  ].join(" ")}
                />
              );
            }),
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setChecked(true)}
            className="h-9 rounded-full border border-[#d9ddd9] bg-[#eceeeb] px-4 text-sm font-semibold text-[#6f7771]"
          >
            Check
          </button>
          <button
            type="button"
            onClick={revealHint}
            className="h-9 rounded-full border border-[#dfe2df] bg-[#fbfbfa] px-4 text-sm font-semibold text-[#7e8580]"
          >
            Hint
          </button>
          <button
            type="button"
            onClick={() => {
              setBoard(emptyBoard());
              setChecked(false);
              setHintCell(null);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[#dfe2df] bg-[#fbfbfa] px-4 text-sm font-semibold text-[#7e8580]"
          >
            <RotateCcw size={16} aria-hidden="true" />
            Reset
          </button>
        </div>

        <p className="min-h-6 text-sm font-medium text-[#9aa09b]">
          {isSolved
            ? "Solved."
            : checked && mistakes.length > 0
              ? `${mistakes.length} wrong cell${mistakes.length === 1 ? "" : "s"}.`
              : checked
                ? "No mistakes so far."
                : "One clean puzzle. No timer."}
        </p>
      </section>
    </main>
  );
}
