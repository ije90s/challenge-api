export const checkDate = (startDate: string, endDate: string): boolean => {
  const newStartDate = new Date(startDate);
  const newEndDate = new Date(endDate);
  const today = new Date();

  // 날짜 형식 체크
  if (isNaN(newStartDate.getTime()) || isNaN(newEndDate.getTime())) {
    return false;
  }

  // 시작일 < 종료일
  if (newStartDate >= newEndDate) {
    return false;
  }

  return true;
};
