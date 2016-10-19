/*!
 * mchain.js -- JavaScript Library for HTML5 Web Database
 * http://kujirahand.com
 * Copyright 2010, kujirahand.com
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

/**
 * @projectDescription JavaScript Library for HTML5 Web Database
 * mchain.js
 * @author		kujirahand.com
 * @version		1.0.1
 * @date		2010-06-26
 */

(function(_global){

  /** console object */
  if (_global["console"] == undefined) {
    _global.console = {
      log: function (message) {
          var con = document.getElementById("console");
          if (con != undefined) {
            con.innerHTML += "<div>" + message + "</div>";
          }
        }
    };
  }

  /** $ function */
  if (_global["$"] == undefined) {
    _global.$ = function(id) { return document.getElementById(id); };
  }

  /** $each function */
  if (_global["$each"] == undefined) {
    _global.$each = function(obj, f) {
      if (obj instanceof Array) {
        for (var i = 0; i < obj.length; i++) { f(i,obj[i]); }
      }
      else {
        for (var i in obj) { f(i,obj[i]); }
      }
    };
  }

  /** mchainClass */
  _global.mchainClass = function() { };
  _global.mchainClass.prototype = {
    /** initialize properties */
    init : function () {
      this.db      = null;
      this.tr_ary  = [];
      this.cur_tr  = null;
      this.cur_sql = null;
      return this;
    },
    /** open database
     * @param {String} dbname
     * @return {mchainClass}
     */
    openDatabase : function (dbname) {
      this.init();
      this.db = window.openDatabase(dbname,"1.0","db",1024*1024);
      return this;
    },
    /** begin transaction
     * @param {Function} onError
     * @param {Function} onSuccess
     * @return {mchainClass}
     */
    transaction : function (onError, onSuccess) {
      // console.log("transaction");
      if (this.db == null) {
        new Error('Database is not open.');
      }
      this.cur_tr = {"ok":onSuccess, "ng":onError, "sqls":[]};
      this.tr_ary.push(this.cur_tr);
      return this;
    },
    /** set transaction ok event
     * @param {Function} f
     * @retnr {mchainClass}
     */
    transaction_ok : function (f) {
      this.cur_tr.ok = f;
      return this;
    },
    /**
     * execute sql
     * @param {String} sql
     * @param {Array} args
     * @param {Function} onSuccess
     * @param {Function} onError
     * @return {mchainClass}
     */
    executeSql : function (sql, args, onSuccess, onError) {
      // console.log("executeSql");
      if (args == undefined) { args = []; }
      if (this.cur_tr == null) {
        this.transaction();
      }
      this.cur_sql = {"sql":sql, "args":args, "ok":onSuccess, "ng":onError};
      this.cur_tr.sqls.push(this.cur_sql);
      return this;
    },
    /**
     * set sql ok event 
     * @param {Function} f
     * @return {mchainClass}
     */
    executeSql_ok : function (f) {
      this.cur_sql.ok = f;
      return this;
    },
    /**
     * commit all action
     * @param {Function} onSuccess
     * @param {Function} onError
     * @return {mchainClass}
     */
    commit : function (onSuccess, onError) {
      // set event (option)
      if (onSuccess) { this.cur_tr.ok = onSuccess; }
      if (onError) { this.cur_tr.ng = onError; }
      // action
      var commit_f = this;
      var exec_trans_f, next_trans_f, ok_trans_f, ng_trans_f;
      // transaction event
      ok_trans_f = function() {
        if (commit_f.cur_tr.ok) { commit_f.cur_tr.ok(); }
        next_trans_f();
      };
      ng_trans_f = function() {
        if (commit_f.cur_tr.ng) { commit_f.cur_tr.ng(); }
        next_trans_f();
      };
      next_trans_f = function() {
        // execute next transaction
        if (commit_f.tr_ary.length == 0) return;
        console.log("next_trans_f:" + commit_f.tr_ary.length);
        commit_f.cur_tr = commit_f.tr_ary.shift();
        commit_f.db.transaction(
          exec_trans_f,
          ng_trans_f,
          ok_trans_f
        );
      };
      exec_trans_f = function(trans_o) {
        console.log("exec_trans_f");
        var ok_sql_f, ng_sql_f, next_sql_f;
        ok_sql_f = function(tr, rs) {
          if (commit_f.cur_sql.ok) { commit_f.cur_sql.ok(tr,rs); }
          console.log("ok_sql_f");
          next_sql_f();
        };
        ng_sql_f = function(tr, err) {
          if (commit_f.cur_sql.ng) { commit_f.cur_sql.ng(); }
          console.log("ng_sql_f");
          console.log(err);
        };
        next_sql_f = function() {
          if (commit_f.cur_tr.sqls.length == 0) return;
          commit_f.cur_sql = commit_f.cur_tr.sqls.shift();
          console.log("executeSql:" + commit_f.cur_sql.sql);
          console.log("args:" + commit_f.cur_sql.args.join(","));
          trans_o.executeSql(
            commit_f.cur_sql.sql,
            commit_f.cur_sql.args,
            ok_sql_f,
            ng_sql_f);
        };
        // chain executeSql
        next_sql_f();
      };
      // transaction start
      next_trans_f();
      return this;
    },
    // ----------------------------------
    // executeSql wrap method
    // ----------------------------------
    /**
     * create table
     * @param {String} table_name
     * @param {Object} field_obj
     * @param {Function} ok event
     * @param {Function} ng event
     * <code>
     * mchain.openDatabase("hoge.db")
     *   .createTable("person_tbl",
     *   {
     *     person_id : "INTEGER PRIMARY KEY", 
     *     name      : "TEXT NOT NULL", 
     *     email     : "TEXT NOT NULL"
     *   })
     *  .commit();
     * </code>
     */
    createTable : function (table_name, field_obj, ok, ng) {
      var a = [];
      for (var f in field_obj) {
        a.push( " `" + f + "` " + field_obj[f] );
      }
      var sql = "CREATE TABLE IF NOT EXISTS `" + table_name + "` " + 
                "(" + a.join(",") + ")";
      this.executeSql(sql, ok, ng);
      return this;
    },
    /** insert
     * @param {String} table_name
     * @param {Object} field_obj
     * @param {Function} ok event
     * @param {Function} ng event
     * <code>
     * mchain.openDatabase("hoge.db")
     *   .insert("person_tbl",
     *   {name:"akira",email:"akira@example.com"})
     *   .commit();
     * </code>
     */
    insert : function (table_name, field_obj, ok, ng) {
      var n = [];
      var v = [];
      var q = [];
      for (var i in field_obj) {
        n.push("`"+i+"`");
        q.push("?");
        v.push(field_obj[i]);
      }
      var sql = "INSERT INTO `" + table_name + "` " +
        "(" + n.join(",") + ")VALUES(" + q.join(",") + ")";
      this.executeSql(sql, v, ok, ng);
      return this;
    },
    /** update
     * @param {String} table_name
     * @param {Object} field_obj
     * @param {Object} where_obj
     * @param {Function} ok event
     * @param {Function} ng event
     * <code>
     * mchain.openDatabase("hoge.db")
     *   .update("person_tbl",
     *   {"name":"akira", "email":"akira@example.com"},
     *   {"person_id":1})
     *   .commit();
     * </code>
     */
    update : function (table_name, field_obj, where_obj, ok, ng) {
      // SET
      var n = [];
      var v = [];
      for (var i in field_obj) {
        n.push("`"+i+"`=?");
        v.push(field_obj[i]);
      }
      // WHERE
      var w = [];
      for (var j in where_obj) {
        w.push("`"+j+"`=?");
        v.push(where_obj[j]);
      }
      if (w.length == 0) {
        throw new Error("[mchain.error] UPDATE without WHERE");
      }
      var sql = "UPDATE `" + table_name + "` " +
                "SET     " + n.join(",") + " " +
                "WHERE   " + w.join(" AND ");
      this.executeSql(sql, v, ok, ng);
      return this;
    },
    /** deleteRow
     * @param {String} table_name
     * @param {Object} where_obj
     * @param {Function} ok event
     * @param {Function} ng event
     * <code>
     * mchain.openDatabase("hoge.db")
     *   .deleteRow("person_tbl", {"person_id":1})
     *   .commit();
     * </code>
     */
    deleteRow : function (table_name, where_obj, ok, ng) {
      // WHERE
      var w = [];
      var v = [];
      for (var j in where_obj) {
        var where_v = where_obj[j];
        if (where_v instanceof Array) {
          var a = [];
          for (var k in where_v) {
            a.push("?");
            v.push(where_v[k]);
          }
          var s = "`" + j + "` in (" + a.join(",") + ")";
          w.push(s);
        } else {
          w.push("`"+j+"`=?");
          v.push(where_v);
        }
      }
      if (w.length == 0) {
        throw new Error("[mchain.error] DELETE without WHERE");
      }
      var sql = "DELETE FROM `" + table_name + "` " +
                "WHERE   " + w.join(" AND ");
      this.executeSql(sql, v, ok, ng);
      return this;
    },
    /** select
     * @param {String} table_name
     * @param {Object} where_obj
     * @param {Function} ok event
     * @param {Function} ng event
     * <code>
     * // select all rows
     * mchain.select("person_tbl", {}, showItems)
     *       .commit();
     * // select by id list
     * mchain.select("person_tbl", {"person_id":[1,2,5]}, showItems)
     *       .commit();
     * </code>
     */
    select : function (table_name, where_obj, ok, ng) {
      // WHERE
      var w = [];
      var v = [];
      for (var j in where_obj) {
        var where_v = where_obj[j];
        if (where_v instanceof Array) {
          var a = [];
          for (var k in where_v) {
            a.push("?");
            v.push(where_v[k]);
          }
          var s = "`" + j + "` in (" + a.join(",") + ")";
          w.push(s);
        } else {
          w.push("`"+j+"`=?");
          v.push(where_v);
        }
      }
      var sql = "SELECT * FROM `" + table_name + "` ";
      if (w.length > 0) {
        sql += " WHERE " + w.join(" AND ");
      }
      this.executeSql(sql, v, ok, ng);
      return this;
    },
    //---
    end_of_mchain : 0
  };
  /** mchain object */
  _global.mchain = new _global.mchainClass();
})(this);

