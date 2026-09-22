type TodoEmptyStateProps = {
  message: string
}

export function TodoEmptyState({ message }: TodoEmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  )
}
