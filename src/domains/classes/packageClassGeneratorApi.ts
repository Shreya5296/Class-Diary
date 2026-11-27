import { sendApiRequest } from '../../api/apiClient';

export interface GeneratePackageClassesResult {
  success: boolean;
  dry_run?: boolean;
  count: number;
  createdCount: number;
  totalPurchased?: number;
  existingCount?: number;
  lastClassDate?: string | null;
  message?: string;
  data?: any[];
}

export async function generatePackageClasses(
  studentId: string,
  token?: string | null,
  options?: {
    dryRun?: boolean;
    regenerateFuture?: boolean;
    packageId?: string;
    startDate?: string;
    extendToEndDate?: boolean;
  }
): Promise<GeneratePackageClassesResult> {
  const payload: Record<string, unknown> = {
    student_id: studentId,
  };
  if (options?.dryRun) payload.dry_run = true;
  if (options?.regenerateFuture) payload.regenerate_future = true;
  if (options?.packageId) payload.package_id = options.packageId;
  if (options?.startDate) payload.start_date = options.startDate;
  if (options?.extendToEndDate) payload.extend_to_end_date = true;

  const response = await sendApiRequest<any>(
    'classes.generateForPackage',
    payload,
    { token }
  );
  const raw = response.data || {};
  if (Array.isArray(raw)) {
    return { success: true, count: raw.length, createdCount: raw.length, data: raw };
  }
  return raw;
}
