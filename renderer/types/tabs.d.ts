export interface TabInfo {
  id: number
  name: string
  content: string
  filePath: string | null
}export type TabInfo = {
    id: number
    name: string
    mode?: string | null
  }
  