interface InstructionsListProps {
  instructions: string[];
}

export function InstructionsList({ instructions }: InstructionsListProps) {
  if (!instructions || instructions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold">Instructions</h2>
      <ol className="space-y-3">
        {instructions.map((instruction, index) => (
          <li key={index} className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-medium">
              {index + 1}
            </span>
            <span className="flex-1 pt-1">{instruction}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
