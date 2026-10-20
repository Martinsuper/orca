import type { TodoList } from '../../../../shared/types'
import { translate } from '@/i18n/i18n'

// Why: the built-in list is seeded by the main process as id "default" with the
// English title "Tasks" (see makeDefaultTodoList). Persisted user data keeps
// that title, so localize it at display time instead of migrating stored rows.
// A renamed default list shows its own title.
export function displayTodoListTitle(list: TodoList): string {
  if (list.id === 'default' && list.title === 'Tasks') {
    return translate('auto.components.right.sidebar.TodoNavigation.defaultList', 'Tasks')
  }
  return list.title
}
