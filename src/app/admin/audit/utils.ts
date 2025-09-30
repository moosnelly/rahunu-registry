export const actionBadgeStyles = (action: string) => {
  if (action.startsWith('USER_')) {
    return 'bg-sky-500/15 text-sky-600 dark:text-sky-200';
  }

  if (action.startsWith('ENTRY_')) {
    return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-200';
  }

  return 'bg-accent text-accent-foreground';
};

export const formatActionLabel = (value: string) =>
  value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');

/**
 * Formats audit log details in a user-friendly, human-readable format
 */
export const formatAuditDetails = (action: string, details: any): string => {
  if (!details || details === 'null' || details === null) {
    return 'No additional details recorded.';
  }

  // Parse details if it's a string
  let parsed = details;
  if (typeof details === 'string') {
    try {
      parsed = JSON.parse(details);
    } catch {
      return details; // Return as-is if not valid JSON
    }
  }

  // Format based on action type
  switch (action) {
    case 'ENTRY_VIEWED':
      return formatEntryViewedDetails(parsed);
    case 'ENTRY_CREATED':
      return formatEntryCreatedDetails(parsed);
    case 'ENTRY_UPDATED':
      return formatEntryUpdatedDetails(parsed);
    case 'ENTRY_DELETED':
      return formatEntryDeletedDetails(parsed);
    case 'USER_ROLE_CHANGED':
      return formatUserRoleChangedDetails(parsed);
    case 'USER_STATUS_CHANGED':
      return formatUserStatusChangedDetails(parsed);
    case 'USER_PASSWORD_RESET':
      return 'User password was reset by an administrator.';
    case 'USER_CREATED':
      return formatUserCreatedDetails(parsed);
    case 'USER_SIGNED_IN':
      return 'User signed in to the system.';
    default:
      return JSON.stringify(parsed, null, 2);
  }
};

const formatEntryViewedDetails = (details: any): string => {
  const parts = [];
  
  if (details.entryNo) {
    parts.push(`Entry #${details.entryNo}`);
  }
  if (details.agreementNumber) {
    parts.push(`Agreement: ${details.agreementNumber}`);
  }
  if (details.viewContext) {
    const context = details.viewContext === 'modal' ? 'Quick View' : 
                    details.viewContext === 'edit' ? 'Edit Page' : details.viewContext;
    parts.push(`Context: ${context}`);
  }
  
  return parts.length > 0 ? parts.join(' • ') : 'Entry viewed';
};

const formatEntryCreatedDetails = (details: any): string => {
  const parts = ['New registry entry created'];
  
  if (details.agreementNumber) {
    parts.push(`Agreement Number: ${details.agreementNumber}`);
  }
  if (details.loanAmount) {
    parts.push(`Loan Amount: MVR ${parseFloat(details.loanAmount).toLocaleString()}`);
  }
  if (details.borrowersCount) {
    parts.push(`Borrowers: ${details.borrowersCount}`);
  }
  
  return parts.join(' • ');
};

const formatEntryUpdatedDetails = (details: any): string => {
  if (!details.changes || Object.keys(details.changes).length === 0) {
    return 'Entry was updated';
  }

  const changes = details.changes;
  const parts: string[] = [];
  
  Object.entries(changes).forEach(([field, change]: [string, any]) => {
    const fieldName = formatEntryFieldName(field);
    
    if (change.from !== undefined && change.to !== undefined) {
      const formattedFrom = formatEntryFieldValue(field, change.from);
      const formattedTo = formatEntryFieldValue(field, change.to);
      parts.push(`• ${fieldName}: ${formattedFrom} → ${formattedTo}`);
    } else {
      parts.push(`• ${fieldName} was modified`);
    }
  });
  
  if (parts.length === 0) {
    return 'Entry was updated';
  }
  
  return parts.join('\n');
};

const formatEntryDeletedDetails = (details: any): string => {
  const parts = ['Entry marked as deleted'];
  
  if (details.agreementNumber) {
    parts.push(`Agreement: ${details.agreementNumber}`);
  }
  if (details.reason) {
    parts.push(`Reason: ${details.reason}`);
  }
  
  return parts.join(' • ');
};

const formatUserRoleChangedDetails = (details: any): string => {
  if (details.from && details.to) {
    return `Role changed from ${formatRole(details.from)} to ${formatRole(details.to)}`;
  }
  return 'User role was changed';
};

const formatUserStatusChangedDetails = (details: any): string => {
  if (details.from !== undefined && details.to !== undefined) {
    const fromStatus = details.from ? 'Active' : 'Inactive';
    const toStatus = details.to ? 'Active' : 'Inactive';
    return `Account status changed from ${fromStatus} to ${toStatus}`;
  }
  return 'User account status was changed';
};

const formatUserCreatedDetails = (details: any): string => {
  const parts = ['New user account created'];
  
  if (details.role) {
    parts.push(`Role: ${formatRole(details.role)}`);
  }
  if (details.email) {
    parts.push(`Email: ${details.email}`);
  }
  
  return parts.join(' • ');
};

const formatFieldName = (field: string): string => {
  // Convert camelCase to Title Case
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toLocaleDateString('en-GB');
    return JSON.stringify(value);
  }
  return String(value);
};

const formatRole = (role: string): string => {
  switch (role) {
    case 'ADMIN':
      return 'Administrator';
    case 'DATA_ENTRY':
      return 'Data Entry';
    case 'VIEWER':
      return 'Viewer';
    default:
      return role;
  }
};

const formatEntryFieldName = (field: string): string => {
  // Map field names to user-friendly labels
  const fieldLabels: Record<string, string> = {
    no: 'Registry Number',
    address: 'Address',
    island: 'Island',
    formNumber: 'Form Number',
    date: 'Date',
    branch: 'Branch',
    agreementNumber: 'Agreement Number',
    status: 'Status',
    loanAmount: 'Loan Amount',
    dateOfCancelled: 'Cancellation Date',
    dateOfCompleted: 'Completion Date',
    attachments: 'Attachments',
    isDeleted: 'Deleted Status',
    deletedAt: 'Deletion Date',
  };
  
  return fieldLabels[field] || formatFieldName(field);
};

const formatEntryFieldValue = (field: string, value: any): string => {
  if (value === null || value === undefined) return 'Not set';
  
  // Handle specific field types
  switch (field) {
    case 'status':
      return formatStatus(value);
    
    case 'loanAmount':
      if (typeof value === 'string' || typeof value === 'number') {
        const amount = parseFloat(String(value));
        if (!isNaN(amount)) {
          return `MVR ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
      }
      return String(value);
    
    case 'date':
    case 'dateOfCancelled':
    case 'dateOfCompleted':
    case 'deletedAt':
      return formatDate(value);
    
    case 'isDeleted':
      return value ? 'Deleted' : 'Active';
    
    case 'attachments':
      if (typeof value === 'object' && value !== null) {
        return 'Document files updated';
      }
      return 'Updated';
    
    default:
      return formatValue(value);
  }
};

const formatStatus = (status: string): string => {
  switch (status) {
    case 'ONGOING':
      return 'Active';
    case 'CANCELLED':
      return 'Cancelled';
    case 'COMPLETED':
      return 'Completed';
    default:
      return status;
  }
};

const formatDate = (value: any): string => {
  if (!value) return 'Not set';
  
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return String(value);
  }
};