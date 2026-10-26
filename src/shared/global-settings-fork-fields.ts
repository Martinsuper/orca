/** Fork-only GlobalSettings fields, kept out of global-settings-types.ts so upstream's copy merges cleanly. */
export type GlobalSettingsForkFields = {
  /** Whether Orca checks for new releases automatically in the background.
   *  When off, background and nudge checks stop; manual "Check for Updates"
   *  still works. Defaults on; read as `!== false` so old saves stay enabled. */
  autoCheckForUpdates?: boolean
  /** Optional local plantuml.jar path enabling PlantUML rendering of ```plantuml
   *  blocks in markdown preview. Empty/unset disables PlantUML rendering, which
   *  keeps diagram source on the local machine (no remote PlantUML server). */
  plantumlJarPath?: string
}
