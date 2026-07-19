function getCustomRangeGrids(start: Date, end: Date) {
  const grids = [];
  const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  
  let currentMonth = new Date(startMonth);
  while (currentMonth <= endMonth) {
    // Generate grid for currentMonth
    // ...
    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }
  return grids;
}
console.log("Looks good");
