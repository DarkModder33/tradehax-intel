"""TradeHax helpers. The page injects th_call before this module runs."""

def bars(symbol, timeframe="1Day", limit=200):
    return th_call("bars", symbol, timeframe, limit)

def chain(symbol):
    return th_call("chain", symbol)

def dataset(name):
    return th_call("dataset", name)

def flow(symbol=""):
    return th_call("flow", symbol)
