import type React from 'react'
import type { GlobalSettings } from '../../../../shared/types'
import { translate } from '@/i18n/i18n'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Button } from '../ui/button'
import { SearchableSetting } from './SearchableSetting'

type PlantumlJarPathSettingProps = {
  settings: Pick<GlobalSettings, 'plantumlJarPath'>
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

export function PlantumlJarPathSetting({
  settings,
  updateSettings
}: PlantumlJarPathSettingProps): React.JSX.Element {
  const jarPath = settings.plantumlJarPath ?? ''

  const browseForJar = async (): Promise<void> => {
    const picked = await window.api.shell.pickJarFile()
    if (picked) {
      updateSettings({ plantumlJarPath: picked })
    }
  }

  return (
    <SearchableSetting
      title={translate(
        'auto.components.settings.GeneralEditorSettingsSection.plantumltitle',
        'PlantUML Rendering'
      )}
      description={translate(
        'auto.components.settings.GeneralEditorSettingsSection.plantumldesc',
        'Render ```plantuml diagrams in markdown preview using a local plantuml.jar. Requires Java. Diagram source stays on your machine — no PlantUML server is contacted. Leave empty to disable.'
      )}
      keywords={['plantuml', 'diagram', 'uml', 'jar', 'java', 'markdown', 'preview']}
      className="flex items-center justify-between gap-4 py-2"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <Label>
          {translate(
            'auto.components.settings.GeneralEditorSettingsSection.plantumltitle',
            'PlantUML Rendering'
          )}
        </Label>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.GeneralEditorSettingsSection.plantumlhint',
            'Path to a local plantuml.jar. Requires Java on your PATH. Leave empty to disable.'
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Input
          type="text"
          readOnly
          value={jarPath}
          placeholder={translate(
            'auto.components.settings.GeneralEditorSettingsSection.plantumlplaceholder',
            'No jar selected'
          )}
          className="w-64 text-right"
        />
        <Button variant="outline" size="sm" onClick={() => void browseForJar()}>
          {translate(
            'auto.components.settings.GeneralEditorSettingsSection.plantumlbrowse',
            'Browse…'
          )}
        </Button>
        {jarPath !== '' && (
          <Button variant="ghost" size="sm" onClick={() => updateSettings({ plantumlJarPath: '' })}>
            {translate(
              'auto.components.settings.GeneralEditorSettingsSection.plantumlclear',
              'Clear'
            )}
          </Button>
        )}
      </div>
    </SearchableSetting>
  )
}
