function getCustomRangeGrids(start, end) {
    var grids = [];
    var startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    var endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    var currentMonth = new Date(startMonth);
    while (currentMonth <= endMonth) {
        // Generate grid for currentMonth
        // ...
        currentMonth.setMonth(currentMonth.getMonth() + 1);
    }
    return grids;
}
console.log("Looks good");
