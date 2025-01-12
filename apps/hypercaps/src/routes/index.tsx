import { createFileRoute } from '@tanstack/react-router'
import { MappingList } from '../components/mapping-list'
import { Settings } from '../components/settings'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold">HyperCaps</h1>
        <p className="text-muted-foreground">
          Configure your keyboard mappings and settings.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Key Mappings</CardTitle>
          </CardHeader>
          <CardContent>
            <MappingList />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <Settings />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
