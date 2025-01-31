When I first implemented the binary search, we assumed that the logs were sorted by date. But after I saw the logs it was certain that they were unsorted by date. 
Since the logs were unsorted, I switched to a rolling hash approach with stream processing. 
As the data comes in streams (because reading whole file is not good) rolling hash was better to compute and match the date.


