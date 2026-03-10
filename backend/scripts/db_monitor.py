"""
MongoDB Slow Query Monitor & Index Analyzer
============================================
Usage:
  python3 db_monitor.py --enable-profiler     # Enable profiler
  python3 db_monitor.py --slow-queries        # Show slow queries
  python3 db_monitor.py --index-report        # Index usage report
  python3 db_monitor.py --suggest-indexes     # Suggest new indexes
"""

import os
import sys
import argparse
from datetime import datetime, timezone
from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "paras_reward_db")


def get_db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME], client


def enable_profiler(slow_ms=100):
    """Enable MongoDB profiler for slow queries"""
    db, _ = get_db()
    db.set_profiling_level(1, slow_ms=slow_ms)
    status = db.profiling_info()
    print(f"✅ Profiler enabled for queries > {slow_ms}ms")
    return status


def show_slow_queries(limit=20, min_ms=50):
    """Show slow queries from profiler"""
    db, _ = get_db()
    
    queries = list(db.system.profile.find(
        {"millis": {"$gt": min_ms}}
    ).sort("ts", -1).limit(limit))
    
    if not queries:
        print(f"✅ No slow queries (>{min_ms}ms) found!")
        return
    
    print(f"\n=== SLOW QUERIES (>{min_ms}ms) ===\n")
    
    for i, q in enumerate(queries, 1):
        print(f"--- Query #{i} ---")
        print(f"Collection: {q.get('ns')}")
        print(f"Time: {q.get('millis')}ms")
        print(f"Operation: {q.get('op')}")
        print(f"Plan: {q.get('planSummary', 'N/A')}")
        
        if q.get('command'):
            cmd = q['command']
            if 'filter' in cmd:
                print(f"Filter: {str(cmd['filter'])[:150]}")
            if 'aggregate' in cmd:
                print(f"Aggregate: {cmd['aggregate']}")
        print()


def index_usage_report():
    """Generate index usage report"""
    db, _ = get_db()
    
    collections = [
        "users", "dmt_transactions", "orders", "bill_payment_requests",
        "gift_voucher_requests", "transactions", "vip_payments"
    ]
    
    print("\n=== INDEX USAGE REPORT ===\n")
    
    for coll_name in collections:
        try:
            coll = db[coll_name]
            stats = list(coll.aggregate([{"$indexStats": {}}]))
            
            print(f"📁 {coll_name}")
            
            used_indexes = []
            unused_indexes = []
            
            for stat in stats:
                name = stat.get('name')
                ops = stat.get('accesses', {}).get('ops', 0)
                
                if ops > 0:
                    used_indexes.append((name, ops))
                else:
                    unused_indexes.append(name)
            
            if used_indexes:
                print("  Used indexes:")
                for name, ops in sorted(used_indexes, key=lambda x: -x[1])[:5]:
                    print(f"    ✅ {name}: {ops} ops")
            
            if unused_indexes[:3]:
                print("  Unused indexes (consider removing):")
                for name in unused_indexes[:3]:
                    print(f"    ⚠️ {name}")
            
            print()
            
        except Exception as e:
            print(f"  Error: {e}\n")


def suggest_indexes():
    """Analyze slow queries and suggest indexes"""
    db, _ = get_db()
    
    # Get collections with COLLSCAN (full collection scan)
    queries = list(db.system.profile.find({
        "planSummary": "COLLSCAN"
    }).limit(50))
    
    if not queries:
        print("✅ No COLLSCAN queries found - all queries using indexes!")
        return
    
    print("\n=== INDEX SUGGESTIONS (Based on COLLSCAN queries) ===\n")
    
    suggestions = {}
    
    for q in queries:
        ns = q.get('ns', '').split('.')[-1]
        cmd = q.get('command', {})
        
        filter_keys = []
        if 'filter' in cmd:
            filter_keys = list(cmd['filter'].keys())
        elif 'pipeline' in cmd and cmd['pipeline']:
            for stage in cmd['pipeline']:
                if '$match' in stage:
                    filter_keys = list(stage['$match'].keys())
                    break
        
        if filter_keys and ns:
            key = (ns, tuple(sorted(filter_keys)))
            suggestions[key] = suggestions.get(key, 0) + 1
    
    for (coll, fields), count in sorted(suggestions.items(), key=lambda x: -x[1]):
        print(f"📁 {coll}")
        fields_str = ', '.join(f'"{f}": 1' for f in fields)
        print(f"   Suggested index: {{ {fields_str} }}")
        print(f"   Queries affected: {count}")
        print()


def main():
    parser = argparse.ArgumentParser(description="MongoDB Performance Monitor")
    parser.add_argument("--enable-profiler", action="store_true", help="Enable profiler")
    parser.add_argument("--slow-queries", action="store_true", help="Show slow queries")
    parser.add_argument("--index-report", action="store_true", help="Index usage report")
    parser.add_argument("--suggest-indexes", action="store_true", help="Suggest indexes")
    parser.add_argument("--slow-ms", type=int, default=100, help="Slow query threshold (ms)")
    
    args = parser.parse_args()
    
    if args.enable_profiler:
        enable_profiler(args.slow_ms)
    elif args.slow_queries:
        show_slow_queries(min_ms=args.slow_ms)
    elif args.index_report:
        index_usage_report()
    elif args.suggest_indexes:
        suggest_indexes()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
