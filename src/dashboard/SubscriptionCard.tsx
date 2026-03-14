import { useState } from 'react'
import type { Subscription } from '../types/subscription'
import { archiveSubscription, cancelSubscription, markRenewed } from '../services/subscriptionService'
import { getPreferences } from '../repository/preferencesRepository'
import { formatCurrency } from '../utils/currency'
import SubscriptionEditor from './SubscriptionEditor'

interface Props {
  subscription: Subscription
  onRefresh: () => void
}

const STATUS_COLORS: Record<string, string> = {
  cancel_soon: '#fef2f2',
  renew_soon: '#fffbeb',
  active: '#f0fdf4',
  archived: '#f9fafb',
  canceled: '#f9fafb',
}

const STATUS_LABELS: Record<string, string> = {
  cancel_soon: 'Cancel Soon',
  renew_soon: 'Renew Soon',
  active: 'Active',
  archived: 'Archived',
  canceled: 'Canceled',
}

export default function SubscriptionCard({ subscription: sub, onRefresh }: Props) {
  const [editing, setEditing] = useState(false)

  async function handleArchive() {
    await archiveSubscription(sub.id)
    onRefresh()
  }

  async function handleCancel() {
    await cancelSubscription(sub.id)
    onRefresh()
  }

  async function handleMarkRenewed() {
    await markRenewed(sub.id)
    onRefresh()
  }

  const bgColor = STATUS_COLORS[sub.status] ?? '#f9fafb'
  const dueDate = sub.renewalDate ?? sub.trialEndDate

  return (
    <>
      <div style={{ ...styles.card, background: bgColor }}>
        <div style={styles.header}>
          <span style={styles.name}>{sub.serviceName}</span>
          <span style={styles.badge}>{STATUS_LABELS[sub.status]}</span>
        </div>

        <div style={styles.meta}>
          {dueDate && <span>Due: {dueDate}</span>}
          {sub.cost !== undefined && <span>{formatCurrency(sub.cost, sub.currency)}</span>}
          {sub.billingFrequency && <span>{sub.billingFrequency}</span>}
        </div>

        <div style={styles.actions}>
          <button style={styles.actionBtn} onClick={() => setEditing(true)}>Edit</button>
          {sub.cancellationUrl && (
            <a href={sub.cancellationUrl} target="_blank" rel="noreferrer" style={styles.actionLink}>
              Cancel page
            </a>
          )}
          <button style={styles.actionBtn} onClick={handleMarkRenewed}>Renewed</button>
          <button style={styles.actionBtn} onClick={handleArchive}>Archive</button>
          <button style={{ ...styles.actionBtn, color: '#dc2626' }} onClick={handleCancel}>Cancel</button>
        </div>
      </div>

      {editing && (
        <SubscriptionEditor
          subscription={sub}
          onSave={() => { setEditing(false); onRefresh() }}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}

// suppress unused import warning
void getPreferences

const styles: Record<string, React.CSSProperties> = {
  card: { borderRadius: '8px', padding: '14px 16px', marginBottom: '10px', border: '1px solid #e5e7eb' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
  name: { fontWeight: 600, fontSize: '15px' },
  badge: { fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: '#e5e7eb', color: '#374151' },
  meta: { display: 'flex', gap: '12px', fontSize: '13px', color: '#6b7280', marginBottom: '10px' },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  actionBtn: { background: 'none', border: '1px solid #d1d5db', borderRadius: '4px', padding: '3px 10px', fontSize: '12px', cursor: 'pointer', color: '#374151' },
  actionLink: { border: '1px solid #d1d5db', borderRadius: '4px', padding: '3px 10px', fontSize: '12px', cursor: 'pointer', color: '#2563eb', textDecoration: 'none' },
}
