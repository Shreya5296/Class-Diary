import { MOCK_STUDENTS, MOCK_PACKAGES, MOCK_PAYMENTS } from './mockDataInitial';

export function handleMockCreatePackage(payload: Record<string, unknown>) {
  const newPkg = {
    package_id: `pkg_${Date.now()}`,
    student_id: String(payload.student_id || ''),
    student_name: String(payload.student_name || ''),
    plan_type: String(payload.plan_type || 'PACKAGE'),
    currency: String(payload.currency || 'INR').toUpperCase(),
    package_price: Number(payload.package_price || payload.price || 0),
    per_class: Number(payload.per_class || 0),
    classes_purchased: Number(payload.classes_purchased || payload.total_classes || 0),
    total_classes: Number(payload.classes_purchased || payload.total_classes || 0),
    class_duration: payload.class_duration ? Number(payload.class_duration) : undefined,
    status: 'ACTIVE'
  };
  MOCK_PACKAGES.unshift(newPkg);
  return newPkg;
}

export function handleMockRecordPayment(payload: Record<string, unknown>) {
  const sid = String(payload.student_id || '');
  const stu = MOCK_STUDENTS.find((s) => s.student_id === sid);
  const sname = stu ? stu.student_name : String(payload.student_name || sid);
  const cur = String(payload.currency || 'INR').toUpperCase();
  const amt = Number(payload.amount) || 0;
  const inInr = payload.in_inr !== undefined && payload.in_inr !== null ? Number(payload.in_inr) : (cur === 'INR' ? amt : 0);
  const newPay = {
    payment_id: `pay_${Date.now()}`,
    student_id: sid,
    student_name: sname,
    amount: amt,
    currency: cur,
    in_inr: inInr,
    payment_date: String(payload.payment_date || new Date().toISOString().slice(0, 10)),
    status: 'RECORDED',
    payment_status: 'RECORDED'
  };
  MOCK_PAYMENTS.push(newPay);
  return newPay;
}
