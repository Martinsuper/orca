import { useState, type KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'

type TodoAddInputProps = {
  onAdd: (title: string) => void
  placeholder: string
}

export function TodoAddInput({ onAdd, placeholder }: TodoAddInputProps): React.JSX.Element {
  const [value, setV] = useState('')

  const submit = () => {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return
    }
    onAdd(trimmed)
    setV('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5">
      <Plus size={14} className="text-muted-foreground shrink-0" />
      <input
        className="bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none flex-1 min-w-0"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}
