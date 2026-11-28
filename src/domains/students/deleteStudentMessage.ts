export interface DeleteImpactPreview {
  classesCount: number;
  packagesCount: number;
  paymentsCount: number;
}

export interface DeleteResultCounts {
  deletedStudents?: number;
  deletedClasses?: number;
  deletedPackages?: number;
  deletedPayments?: number;
  deletedFees?: number;
}

export function formatDeleteResultMessage(
  preview: DeleteImpactPreview,
  counts: DeleteResultCounts
): { message: string; isWarning: boolean } {
  const delCls = counts.deletedClasses ?? 0;
  const delPkgs = counts.deletedPackages ?? 0;
  const delPays = counts.deletedPayments ?? 0;

  const countsText = `Deleted student + ${delCls} class${delCls === 1 ? '' : 'es'} + ${delPkgs} package${delPkgs === 1 ? '' : 's'} + ${delPays} payment${delPays === 1 ? '' : 's'}`;

  const hasMismatch =
    (preview.classesCount > 0 && delCls === 0) ||
    (preview.packagesCount > 0 && delPkgs === 0) ||
    (preview.paymentsCount > 0 && delPays === 0);

  if (hasMismatch) {
    return {
      message: `Warning: ${countsText} (expected ${preview.classesCount} classes, ${preview.packagesCount} packages, ${preview.paymentsCount} payments)`,
      isWarning: true,
    };
  }

  return {
    message: countsText,
    isWarning: false,
  };
}
