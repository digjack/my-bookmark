var api = require('express').Router();
var mysql = require('mysql');
var crypto = require('crypto');
var client = mysql.createConnection({
    host: '127.0.0.1',
    user: 'lcq',
    password: 'fendoubuxi596320',
    database: 'mybookmarks',
    multipleStatements: true,
    port: 3306
});
client.connect();

api.post('/logout', function(req, res) {
    var params = req.body.params;
    console.log('logout......', params);
    req.session.destroy();
    res.json({
        data: "logout success",
    });
});

api.post('/clickBookmark', function(req, res) {
    var params = req.body.params;
    var id = params.id;
    var sql = "UPDATE `bookmarks` SET `click_count`=`click_count`+1, `last_click`=now() WHERE (`id`='" + id + "')";
    console.log(sql);
    client.query(sql, function(error, result, fields) {
        res.json({
            id: id,
        });
    })
});

api.post('/login', function(req, res) {
    var params = req.body.params;
    var username = params.username;
    var password = md5(params.password);

    var sql = "SELECT * FROM `users` WHERE `username` = '" + username + "'";
    client.query(sql, function(error, result, fields) {
        var id = '';
        var logined = false;
        var pass = !error && result.length === 1 && password === result[0].password
        console.log(password, result[0].password, pass)
        if (pass) {
            req.session.username = username;
            logined = true;
            id = result[0].id;
        }
        res.json({
            logined: logined,
            userId: id
        });
    })
});

api.get('/autoLogin', function(req, res) {
    if (req.session.username) {
        console.log('session:' + req.session.username);
        var sql = "SELECT * FROM `users` WHERE `username` = '" + req.session.username + "'";
        client.query(sql, function(error, result, fields) {
            var id = '';
            var logined = false;
            if (!error && result.length === 1) {
                req.session.username = result[0].username;
                req.session.id = result[0].id;
                logined = true;
                id = result[0].id;
            }
            res.json({
                logined: logined,
                userId: id,
            });
        })
    } else {
        res.json({
            logined: false,
            userId: '',
        });
    }
});

api.get('/bookmarks', function(req, res) {
    console.log('hello bookmarks', JSON.stringify(req.query));
    if (!req.session.username) {
        res.send(401);
    }
    if (req.query.show === 'navigate') {
        var sql = "SELECT t.id as tag_id, t.name as tag_name, b.* FROM `tags` as t LEFT OUTER JOIN tags_bookmarks as tb ON t.id = tb.tag_id LEFT OUTER JOIN bookmarks as b ON tb.bookmark_id = b.id ORDER BY t.id ASC, b.click_count DESC";
        client.query(sql, function(error, result, fields) {
            var data = [];
            var tag = {
                id: result && result[0] && result[0].tag_id,
                name: result && result[0] && result[0].tag_name,
                click: 0,
                bookmarks: []
            };
            result.forEach(function(bookmark) {
                if (tag.id !== bookmark.tag_id) {
                    data.push({
                        id: tag.id,
                        name: tag.name,
                        click: tag.click,
                        bookmarks: tag.bookmarks
                    });
                    tag.id = bookmark.tag_id;
                    tag.name = bookmark.tag_name;
                    tag.click = 0;
                    tag.bookmarks = [];
                }
                tag.click += bookmark.click_count;
                tag.bookmarks.push(bookmark);
            });
            if (result && result.length > 0) {
                data.push(tag);
            }
            data.sort(function(a, b) {
                return a.click < b.click;
            })
            res.json(data);
        })
    } else {
        var sqlBookmarks = "SELECT id, user_id, title, description, url, public, click_count, DATE_FORMAT(created_at, '%Y-%m-%d') as created_at,  DATE_FORMAT(last_click, '%Y-%m-%d') as last_click FROM `bookmarks` WHERE user_id='1' ORDER BY click_count DESC, created_at DESC LIMIT 0, 50";
        var sqlTags = "SELECT id, name FROM `tags` WHERE user_id='1'";

        client.query(sqlBookmarks, function(error, result1, fields) {
            if (error) {
                res.json({
                    error: "数据查询出错"
                });
            } else {
                var bookmark_ids = ''
                result1.forEach(function(bookmark) {
                    bookmark_ids += "'" + bookmark.id + "',";
                })
                bookmark_ids = bookmark_ids.slice(0, bookmark_ids.length - 1);

                var sqlTagIdBookmarkId = "SELECT * FROM `tags_bookmarks` WHERE bookmark_id in(" + bookmark_ids + ")";
                client.query(sqlTagIdBookmarkId, function(error, result2, fields) {
                    // console.log(result2);
                    if (error) {
                        res.json({
                            error: "数据查询出错"
                        });
                    } else {
                        client.query(sqlTags, function(error, result3, fields) {
                            // console.log(result3);
                            if (error) {
                                res.json({
                                    error: "数据查询出错"
                                });
                            } else {
                                var data = [];
                                result1.forEach(function(bookmark) {
                                    var tags = [];
                                    result2.forEach(function(bookmark_tag) {
                                        if (bookmark_tag.bookmark_id == bookmark.id) {
                                            result3.forEach(function(tag) {
                                                if (bookmark_tag.tag_id == tag.id) {
                                                    tags.push(tag)
                                                }
                                            })
                                        }
                                    });
                                    bookmark.tags = tags;
                                    data.push(bookmark);
                                })
                                res.json(data);
                            }
                        });
                    }
                });
            }
        });
    }
});

api.get('/tags', function(req, res) {
    console.log('hello tags', JSON.stringify(req.query));
    var user_id = req.query.user_id;
    var sql = "SELECT id, name FROM `tags` WHERE `user_id` = '" + user_id + "' ORDER BY last_use DESC"
    client.query(sql, function(error, result, fields) {
        if (error) {
            res.json({
                error: 'error tags'
            });
        } else {
            res.json(result);
        }
    })
});

api.post('/addBookmark', function(req, res) {
    console.log('hello addBookmark', JSON.stringify(req.query), JSON.stringify(req.body));
    var params = req.body.params;
    var user_id = '1';
    var tags = params.tags;
    var sql = "INSERT INTO `bookmarks` (`user_id`, `title`, `description`, `url`, `public`, `click_count`) VALUES ('" + user_id + "', '" + params.title + "', '" + params.description + "', '" + params.url + "', '" + params.public + "', '1')";
    console.log(sql);
    client.query(sql, function(err, result) {
        if (err) throw err;
        var insertId = result.insertId;

        sql = "INSERT INTO `tags_bookmarks` (`tag_id`, `bookmark_id`) VALUES";
        for (var i = 0; i < tags.length; i++) {
            if (i >= 1) {
                sql += ','
            }
            sql += "('" + tags[i] + "', '" + insertId + "')";
        }
        client.query(sql, function(error, result, fields) {
            if (error) {
                res.json({
                    error: 'error tags'
                });
            } else {
                sql = "UPDATE tags SET last_use = NOW() WHERE user_id = '" + user_id + "' AND id in (";
                for (var i = 0; i < tags.length; i++) {
                    if (i >= 1) {
                        sql += ','
                    }
                    sql += "'" + tags[i] + "'";
                }
                sql += ')'
                console.log(sql);
                client.query(sql, function(error, result1, fields) {
                    if (error) {
                        res.json({
                            error: 'error tags'
                        });
                    } else {
                        res.json({
                            hello: 'success'
                        });
                    }
                })

            }
        })

        console.log(result.insertId);
    });

    // res.json({
    //     a: 'i love this world, too!'
    // });
});

api.post('/addTags', function(req, res) {
    console.log('hello addTags', JSON.stringify(req.query), JSON.stringify(req.body));
    var params = req.body.params;
    var user_id = '1';
    var addTagNames = [];
    var sql = "SELECT * FROM `tags` WHERE `user_id` = '" + user_id + "' AND `name` in (";
    for (var i = 0; i < params.length; i++) {
        if (i >= 1) {
            sql += ','
        }
        sql += "'" + params[i] + "'";
    };
    sql += ")";
    console.log(sql);
    client.query(sql, function(error, result1, fields) {
        if (error) {
            res.json({
                error: 'error tags'
            });
        } else {
            params.forEach(function(name) {
                var find = false;
                result1.forEach(function(tag) {
                    if (tag.name == name) {
                        find = true;
                    }
                })
                if (!find) {
                    addTagNames.push(name);
                }
            })

            sql = "INSERT INTO `tags` (`user_id`, `name`) VALUES";
            for (var i = 0; i < addTagNames.length; i++) {
                if (i >= 1) {
                    sql += ','
                }
                sql += "('" + user_id + "', '" + addTagNames[i] + "')";
            }
            if (addTagNames.length == 0) {
                sql = "SELECT id, name FROM `tags` WHERE `user_id` = '" + user_id + "'";
            }
            console.log(sql);
            client.query(sql, function(error, result, fields) {
                if (error) {
                    res.json({
                        error: 'error tags'
                    });
                } else {
                    if (addTagNames.length == 0) {
                        res.json(result);
                    } else {
                        sql = "SELECT id, name FROM `tags` WHERE `user_id` = '" + user_id + "' ORDER BY last_use DESC"
                        client.query(sql, function(error, result, fields) {
                            if (error) {
                                res.json({
                                    error: 'error tags'
                                });
                            } else {
                                res.json(result);
                            }
                        })
                    }
                }
            })
        }
    })
});
// client.end();

function md5(str) {
    return crypto
        .createHash('md5')
        .update(str)
        .digest('hex');
};

module.exports = api;
