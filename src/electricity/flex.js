function formatReading(value) {
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 3 });
}

function formatDate(date) {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date).replace(',', ' •');
}

function meterConfirmationFlex({ meterReading, previousReading, usage, createdAt }) {
  const previousText = previousReading === null ? '-' : formatReading(previousReading);
  const usageText = usage === null ? 'ยังคำนวณไม่ได้' : `${formatReading(usage)} หน่วย`;
  return {
    type: 'flex',
    altText: 'ตรวจสอบมิเตอร์ไฟก่อนบันทึก',
    contents: {
      type: 'bubble', size: 'mega',
      header: { type: 'box', layout: 'vertical', paddingAll: '20px', contents: [
        { type: 'text', text: '⚡ ตรวจสอบมิเตอร์ไฟ', weight: 'bold', size: 'xl', color: '#111111' },
        { type: 'text', text: formatDate(new Date(createdAt)), size: 'sm', color: '#888888', margin: 'sm' }
      ] },
      body: { type: 'box', layout: 'vertical', spacing: 'lg', paddingAll: '20px', contents: [
        { type: 'box', layout: 'vertical', backgroundColor: '#F5F7FA', cornerRadius: '12px', paddingAll: '16px', contents: [
          { type: 'text', text: 'มิเตอร์ครั้งนี้', size: 'sm', color: '#777777' },
          { type: 'text', text: formatReading(meterReading), size: 'xxl', weight: 'bold', color: '#111111', margin: 'sm', align: 'end' },
          { type: 'text', text: 'หน่วย', size: 'sm', color: '#777777', align: 'end' }
        ] },
        { type: 'separator', margin: 'md' },
        { type: 'box', layout: 'vertical', spacing: 'md', margin: 'md', contents: [
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'มิเตอร์ครั้งก่อน', size: 'sm', color: '#777777', flex: 1 },
            { type: 'text', text: previousText, size: 'sm', color: '#111111', align: 'end', weight: 'bold', flex: 1 }
          ] },
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'การใช้ไฟ', size: 'md', color: '#333333', weight: 'bold', flex: 1 },
            { type: 'text', text: usageText, size: 'md', color: '#111111', align: 'end', weight: 'bold', flex: 1 }
          ] }
        ] },
        { type: 'separator', margin: 'md' },
        { type: 'box', layout: 'horizontal', margin: 'md', paddingAll: '12px', backgroundColor: '#FFF8E1', cornerRadius: '10px', contents: [
          { type: 'text', text: '📊 ใช้ไฟไป', size: 'sm', color: '#666666', flex: 1 },
          { type: 'text', text: usageText, size: 'md', weight: 'bold', align: 'end', flex: 1 }
        ] }
      ] },
      footer: { type: 'box', layout: 'horizontal', spacing: 'sm', paddingAll: '16px', contents: [
        { type: 'button', style: 'secondary', height: 'sm', flex: 1, action: { type: 'postback', label: 'ยกเลิก', data: 'action=cancel_meter', displayText: 'ยกเลิก' } },
        { type: 'button', style: 'primary', height: 'sm', flex: 1, action: { type: 'postback', label: 'ยืนยัน', data: 'action=confirm_meter', displayText: 'ยืนยัน' } }
      ] }
    }
  };
}

module.exports = { meterConfirmationFlex };
