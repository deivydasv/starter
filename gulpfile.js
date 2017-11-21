const gulp = require('gulp'),
    headerComment = require('gulp-header-comment'),
    connect = require('gulp-connect'),
    del = require('del'),
    rename = require('gulp-rename'),
    plumber = require('gulp-plumber'),
    argv = require('yargs').argv,
    bump = require('gulp-bump'),
    fs = require('fs'),
    run_sequence = require('run-sequence'),
    git = require('gulp-git'),
    replace = require('gulp-replace'),
    changed = require('gulp-changed'),

    htmlPartial = require('gulp-html-partial'),
    htmlBeautify = require('gulp-html-beautify'),

    sass = require('gulp-sass'),
    autoprefixer = require('gulp-autoprefixer'),
    csso = require('gulp-csso'),
    stylelint = require('gulp-stylelint'),
    sourcemaps = require('gulp-sourcemaps'),

    uglify = require('gulp-uglify'),
    babel = require('gulp-babel'),

    imagemin = require('gulp-imagemin'),
      
    moment = require('moment'),
    pkg = function () {
        return JSON.parse(fs.readFileSync('package.json', 'utf8'));
    },
    concat = require('gulp-concat'),
    meta = ['<%= pkg.name %> (<%= pkg.homepage %>)',
              'Version: <%= pkg.version %>',
              'Last update on: <%= moment().format(\'YYYY-MM-DD HH:mm:ss\') %>',
              'Author: <%= pkg.author %>'
             ].join('\n');





// HTML

gulp.task('html', function () {
    return gulp.src(['src/html/**/[!_]*.html'])
        .pipe(plumber())
        .pipe(htmlPartial({
            basePath: 'src/html/'
        }))
        .pipe(htmlBeautify({
            indent_char: ' ',
            indent_size: 2
        }))
        .pipe(headerComment(meta))
        .pipe(replace(/\n\s*<!--DEV[\s\S]+?-->/gm, ''))
        .pipe(gulp.dest('dist'))
        .pipe(connect.reload())
});




// STYLES

gulp.task('styles', function () {
    return gulp.src(['src/scss/**/[!_]*.scss'])
        .pipe(plumber())
        .pipe(sourcemaps.init())
        .pipe(headerComment(meta + '\n'))
        .pipe(sass({
            outputStyle: 'expanded',
            precision: 4
        }))
        .pipe(autoprefixer({
            browsers: ['last 2 versions'],
            flexbox: 'no-2009'
        }))
        //.pipe(concat( pkg().name.toLowerCase() + '.css'))
        //.pipe(concat('style.css')) 
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist/css'))
        .pipe(connect.reload())
});

gulp.task('styles-minify', function () {
    return gulp.src(['src/scss/**/[!_]*.scss'])
        //.pipe(sourcemaps.init())
            .pipe(headerComment(meta + '\n'))
            .pipe(sass({
            outputStyle: 'expanded',
            precision: 4
        }))
            .pipe(autoprefixer({
            browsers: ['last 2 versions'],
            flexbox: 'no-2009'
        }))
        .pipe(csso({
            //sourceMap: true
        }))
        //.pipe(concat( pkg().name.toLowerCase() + '.css')) 
        //.pipe(concat('style.css')) 
        .pipe(rename({
            extname: '.min.css'
        }))
        //.pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist/css'));
});

gulp.task('styles-lint', function () {
    return gulp.src(['src/scss/**/*.scss'])
        .pipe(plumber())
        .pipe(stylelint({
            failAfterError: false,
            reporters: [{
                formatter: 'string',
                console: true
            }]
        }));
});




// SCRIPTS

gulp.task('scripts', function () {
    return gulp.src(['src/js/**/*.js'])
        .pipe(plumber())
        .pipe(sourcemaps.init())
        .pipe(babel())
        //.pipe(concat('scripts.js')) 
        .pipe(headerComment(meta))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist/js'))
        .pipe(connect.reload())
});

gulp.task('scripts-minify', function () {
    //return gulp.src(['node_modules/babel-polyfill/dist/polyfill.min.js', 'src/**/*.js'])
    return gulp.src(['src/js/**/*.js'])
        //.pipe(sourcemaps.init())
        .pipe(babel())
        //.pipe(concat('scripts.js')) 
        .pipe(uglify())
        .pipe(headerComment(meta))
        .pipe(rename({
            extname: '.min.js'
        }))
        //.pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist/js'));
});





// IMAGES

//https://www.npmjs.com/package/gulp-svgstore
gulp.task('images', function () {
    return gulp.src(['src/img/**/*.{jpg,jpeg,png,gif,svg}'])
        .pipe(plumber())
        .pipe(changed('dist/img'))
        .pipe(imagemin([
            imagemin.jpegtran({
                progressive: true
            }),
            imagemin.optipng({
                optimizationLevel: 5
            }),
            imagemin.gifsicle({
                interlaced: true
            }),
            imagemin.svgo({ 
                plugins: [ //https://github.com/svg/svgo
                    {removeViewBox: false},
                    {cleanupIDs: false}
                ]
            })
        ]))
        .pipe(gulp.dest('dist/img'))
        .pipe(connect.reload())
});


// MISC

gulp.task('del', function () {
    return del(['dist']);
});

gulp.task('connect', function () {
    return connect.server({
        root: '.',
//        port: 8080,
        livereload: true
    });
});

gulp.task('default', ['del'], function () {
    gulp.start(['connect', 'html', 'styles', 'scripts', 'images']);

    gulp.watch(['src/**/*.html'], ['html']);
    gulp.watch(['src/**/*.scss'], ['styles', 'styles-lint']);
    gulp.watch(['src/**/*.js'], ['scripts']);
    gulp.watch(['src/img/**/*'], ['images']);
});


// gulp build (default: patch)
// gulp build --t=prerelease
// gulp build --t=patch
// gulp build --t=minor
// gulp build --t=major

gulp.task('build', function () {
    run_sequence(
        'del',
        'bump',
        'html',
        'styles',
        'scripts',
        'styles-minify',
        'scripts-minify',
        'images',
        //'changelog',
        'commit-changes',
        'push-changes',
        'create-new-tag',
        //'github-release',
        function (error) {
            if (error) {
                console.log(error.message);
            } else {
                console.log(pkg().version + ' BUILD FINISHED SUCCESSFULLY');
            }
        });
});

gulp.task('bump', function () {
    return gulp.src(['package.json'])
        .pipe(bump({
            type: argv.t || 'patch'
        }))
        .pipe(gulp.dest('.'));
});

gulp.task('commit-changes', function () {
    return gulp.src('.')
        .pipe(git.add())
        .pipe(git.commit('version: ' + pkg().version));
});

gulp.task('push-changes', function (cb) {
    git.push('origin', 'master', cb);
});

gulp.task('create-new-tag', function (cb) {
    let version = pkg().version;
    git.tag(version, 'Version: ' + version, function () {
        git.push('origin', 'master', {
            args: '--tags'
        }, cb);
    });
});

//const conventionalChangelog = require('gulp-conventional-changelog');
//gulp.task('changelog', function () {
//    return gulp.src('CHANGELOG.md', {
//        buffer: false
//    })
//        .pipe(conventionalChangelog({
//        preset: 'test'
//    }))
//        .pipe(gulp.dest('./'));
//});
//
//const conventionalGithubReleaser = require('conventional-github-releaser');
//gulp.task('github-release', function(done) {
//    conventionalGithubReleaser({
//        type: "oauth",
//        token: 'xxx' // change this to your own GitHub token or use an environment variable
//    }, {
//        preset: 'test' // Or to any other commit message convention you use.
//    }, done);
//});