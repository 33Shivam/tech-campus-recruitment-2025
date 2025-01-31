Firstly I tried implemented the binary search, we assumed that the logs were sorted by date (at that moment we hadn't downloaded the logs) It would have chnaged the complexity from O(N) to O(logN).

But after I saw the logs it was certain that they were unsorted by date. 
Since the logs were unsorted, I switched to a rolling hash approach with stream processing.
Why stream processing? It would be tedious to get and read the whole 1TB file at once hence its better to get them in chuncks of data. Moreover why rolling hash or RabinKarp over naive string matching alogrithm? This is due to the fact that Hash comparisons are generally faster than character-by-character comparisons.


